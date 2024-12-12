const jsonServer = require('json-server');
const server = jsonServer.create();
const router = jsonServer.router('db.json');
const middlewares = jsonServer.defaults();

// Використовуємо дефолтні middleware (logger, static, cors і no-cache)
server.use(middlewares);

// Додаємо CORS headers
server.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', '*');
    next();
});

// Використовуємо router
server.use(router);

// Запускаємо сервер
const port = 3000;
server.listen(port, '0.0.0.0', () => {
    console.log(`JSON Server is running on http://192.168.0.105:${port}`);
}); 