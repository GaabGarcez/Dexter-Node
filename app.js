const express = require('express');
const { WebSocketServer, WebSocket } = require('ws'); // Importação adicional aqui
const http = require('http');
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });
const { v4: uuidv4 } = require('uuid');
const clients = {};
const requisicoesPendentes = {};

app.use(express.json());

app.post('/request', async (req, res) => {
    const { uuid_user, mensagem } = req.body;
    const client = clients[uuid_user];
    const id_requisicao = uuidv4();

    if (client && client.readyState === WebSocket.OPEN) {
        // Atribua todas as propriedades de uma vez
        requisicoesPendentes[id_requisicao] = { res, timer: null, resolve: null };
        try {
            client.send(JSON.stringify({ id: id_requisicao, mensagem }));
            await aguardarResposta(id_requisicao, 35000); // Aguarda por 35 segundos para a resposta
        } catch (error) {
            console.error('O Dexter não está em execução no seu servidor. Contate o suporte.', error);
            delete clients[uuid_user];
            delete requisicoesPendentes[id_requisicao];
            res.send('O Dexter não está em execução no seu servidor. Contate o suporte.');
        }
    } else {
        delete clients[uuid_user];
        res.send('O Dexter não está em execução no seu servidor. Contate o suporte.');
    }
});

wss.on('connection', (ws, req) => {
    const uuid = req.url.split('/connection/')[1]; // Extrai o UUID da URL
    if (clients[uuid]) {
        clients[uuid].terminate(); // Fecha a conexão antiga, se existir
    }
    clients[uuid] = ws;

    ws.on('pong', () => {
        ws.isAlive = true;
    });

    ws.on('message', (message) => {
        const resposta = JSON.parse(message);
        const id_requisicao = resposta.id;
        const resHttp = requisicoesPendentes[id_requisicao];
        if (resHttp) {
            clearTimeout(resHttp.timer); // Limpa o timer do timeout
            resHttp.resolve(); // Resolve a promessa em aguardarResposta
            resHttp.res.send(resposta.mensagem); // Envia a resposta ao cliente HTTP
            delete requisicoesPendentes[id_requisicao]; // Remove da lista de pendentes
        }
    });
});

function aguardarResposta(id_requisicao, timeoutMs) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            if (requisicoesPendentes[id_requisicao]) {
                requisicoesPendentes[id_requisicao].res.send('O Dexter não está em execução no seu servidor. Contate o suporte.');
                delete requisicoesPendentes[id_requisicao];
                reject(new Error('O Dexter não está em execução no seu servidor. Contate o suporte.'));
            }
        }, timeoutMs);

        requisicoesPendentes[id_requisicao].timer = timer; // Armazena o timer
        requisicoesPendentes[id_requisicao].resolve = resolve; // Armazena a função resolve
    });
}

// Ligar o servidor Express ao WebSocketServer
server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
});

const PORT = process.env.PORT || 1000;

// Escutando a porta usando o servidor HTTP
server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});