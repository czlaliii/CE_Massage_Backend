import express from 'express';

const app = express();
const portNumber = 3000;

app.get('/', (_, res) => {
    res.send('CE Massage Backend');
});

app.get('/health', (_, res) => {
    res.json({
        status: 'ok'
    });
});

app.listen(portNumber, () => {
    console.log('Server started on Port:', portNumber);
});