import sql from 'mssql';

export const pool = new sql.ConnectionPool({
    user: 'webapp',
    password: 'W3b4ppingT0n',
    server: '192.168.0.243',
    database: 'Service Template',
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
});

export const poolConnect = pool.connect();