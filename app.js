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
    const id_requisicao = uuidv4();  // Gera um UUID único

    if (client && client.readyState === WebSocket.OPEN) {
        requisicoesPendentes[id_requisicao] = res;  // Armazena a resposta HTTP para enviar depois que a resposta do cliente chegar
        try {
            client.send(JSON.stringify({ id: id_requisicao, mensagem }));
        } catch (error) {
            console.error("Erro ao enviar mensagem para o cliente:", error);
            delete clients[uuid_user];
            delete requisicoesPendentes[id_requisicao]; // Remove a requisição pendente também aqui
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
    ws.on('message', (message) => {
        const resposta = JSON.parse(message);
        const resHttp = requisicoesPendentes[resposta.id];
        if (resHttp) {
            resHttp.send(resposta.mensagem);
            delete requisicoesPendentes[resposta.id];  // Limpa a referência depois de enviar a resposta
        }
    });
});

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