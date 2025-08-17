import path from 'path';
import express from 'express';
import { fileURLToPath } from 'url';
import port from './src/port.js';
import { pool, poolConnect } from './src/db.js';
import sql from 'mssql';
import ExcelJS from 'exceljs';

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dependencies for the app to read user input and to return JSONs.
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend/dist')));

app.listen(port, '127.0.0.1', () => {
    console.log(`App running on port ${port}`);
});

// END BOILERPLATE.

app.post('/api/service', async (req, res) => {
    try {
        await poolConnect; // Tests the pool connection before continuing.

        const { make, part, customer, injectors, ohm } = req.body;
        const result2 = await pool.request()
            .input('make', sql.VarChar(50), make)
            .input('part', sql.VarChar(50), part)
            .input('customer', sql.VarChar(50), customer)
            .input('ohm', sql.Decimal(8, 2), ohm)
            .input('datetime', sql.DateTime, new Date(new Date().toLocaleDateString()))
            .query(`INSERT INTO processes
                (make, part, customer, ohm, datetime)
                OUTPUT inserted.*
                VALUES
                (@make, @part, @customer, @ohm, @datetime)`);

        const request = pool.request();
        let sqlString = `INSERT INTO injectors 
            (process_id, injector_serial, duty_100_before, duty_100_after, 
            duty_50_before, duty_50_after, idle_before, idle_after)
            VALUES `;
        const values = [];

        for (let i = 0; i < injectors.length; i++) {
            request.input(`processId${i}`, sql.Int, parseInt(result2.recordset[0].process_id));
            request.input(`injectorSerial${i}`, sql.VarChar(50), injectors[i].injectorSerial);
            request.input(`duty100Before${i}`, sql.Int, parseInt(injectors[i].duty100Before));
            request.input(`duty100After${i}`, sql.Int, parseInt(injectors[i].duty100After));
            request.input(`duty50Before${i}`, sql.Int, parseInt(injectors[i].duty50Before));
            request.input(`duty50After${i}`, sql.Int, parseInt(injectors[i].duty50After));
            request.input(`idleBefore${i}`, sql.Decimal(10, 2), parseFloat(injectors[i].idleBefore));
            request.input(`idleAfter${i}`, sql.Decimal(10, 2), parseFloat(injectors[i].idleAfter));
            values.push(`(@processId${i}, @injectorSerial${i}, @duty100Before${i}, @duty100After${i},
            @duty50Before${i}, @duty50After${i}, @idleBefore${i}, @idleAfter${i})`);
        }

        sqlString += values.join(', ');
        const result = await request.query(sqlString);
        return res.status(200).json({ message: 'Hey!' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'error!' });
    }
});

app.get('/api/export', async (req, res) => {
    try {
        await poolConnect;

        const { processId } = req.query;
        const request = pool.request();
        request.input('processId', sql.Int, parseInt(processId));
        const results = await request.query('SELECT * FROM injectors WHERE process_id = @processId');
        const results2 = await request.query('SELECT * FROM processes WHERE process_id = @processId');

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile('./src/assets/template.xlsx');
        const sheet = workbook.getWorksheet('Sheet1');

        results.recordset.forEach((injector, index) => {
            sheet.getCell(`A${index + 7}`).value = injector.injector_serial;
            sheet.getCell(`B${index + 7}`).value = injector.duty_100_before;
            sheet.getCell(`C${index + 7}`).value = injector.duty_100_after;
            sheet.getCell(`D${index + 7}`).value = injector.duty_50_before;
            sheet.getCell(`E${index + 7}`).value = injector.duty_50_after;
            sheet.getCell(`F${index + 7}`).value = injector.idle_before;
            sheet.getCell(`G${index + 7}`).value = injector.idle_after;
        });

        const process = results2.recordset[0];
        sheet.getCell('B2').value = process.make;
        sheet.getCell('B3').value = process.part;
        sheet.getCell('J3').value = process.ohm;
        sheet.getCell('J1').value = process.datetime;

        // Sets the header so that the Excel file is processed correctly.
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="Services.xlsx"');

        // Sends the Excel file.
        await workbook.xlsx.write(res);

        return res.status(200).end();
    } catch (err) {
        console.log(err);
        return res.status(500).json(err);
    }

});
