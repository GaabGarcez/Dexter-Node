const express = require('express');
const { WebSocketServer } = require('ws');
const app = express();
const wss = new WebSocketServer({ noServer: true });
const clients = {};

app.use(express.json());

app.post('/request', async (req, res) => {
    const { uuid_user, mensagem } = req.body;
    const client = clients[uuid_user];

    if (client && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ mensagem }));

        // Aguarda resposta do cliente
        const resposta = await aguardarResposta(client);
        res.send(resposta);
    } else {
        res.send("O Dexter não está ativo");
    }
});
wss.on('connection', (ws, req) => {
    const uuid = req.url.split('/')[1]; // Extrai o UUID da URL
    clients[uuid] = ws;
    if (clients[uuid]) {
        clients[uuid].terminate(); // Fecha a conexão antiga, se existir
    }
    clients[uuid] = ws;

    ws.on('pong', () => {
        ws.isAlive = true;
    });

    // Restante do código
});

// Função para aguardar resposta do cliente
function aguardarResposta(ws) {
    return new Promise((resolve, reject) => {
        ws.once('message', (message) => {
            resolve(message);
        });
        // Implemente um timeout ou lógica de erro, se necessário
    });
}

