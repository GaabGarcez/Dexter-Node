const express = require('express');
const { WebSocketServer, WebSocket } = require('ws'); // Importação adicional aqui
const http = require('http');
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });
const clients = {};

app.use(express.json());

app.post('/request', async (req, res) => {
    const { uuid_user, mensagem } = req.body;
    const client = clients[uuid_user];

    if (client && client.readyState === WebSocket.OPEN) { // Usando WebSocket.OPEN
        try {
            client.send(JSON.stringify({ mensagem }));
            const resposta = await aguardarResposta(client);
            res.send(resposta);
        } catch (error) {
            console.error("Erro ao enviar mensagem para o cliente:", error);
            delete clients[uuid_user];
            res.send("O Dexter não está em execução no seu servidor. Contate o suporte.");
        }
    } else {
        delete clients[uuid_user];
        res.send("O Dexter não está em execução no seu servidor. Contate o suporte.");
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

    // Restante do código...
});

// Função para aguardar resposta do cliente
function aguardarResposta(ws, timeoutMs = 35000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            ws.removeListener('message', onMessage);
            reject(new Error('O Dexter não está em execução no seu servidor. Contate o suporte.'));
        }, timeoutMs);

        const onMessage = (message) => {
            clearTimeout(timer);
            resolve(message);
        };

        ws.once('message', onMessage);
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