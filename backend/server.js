import path from 'path';
import express from 'express';
import { fileURLToPath } from 'url';
import port from './src/port.js';
import { pool, poolConnect } from './src/db.js';
import sql from 'mssql';
import ExcelJS from 'exceljs';
import { exec } from 'child_process';
import fs from 'fs';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import { PDFDocument } from 'pdf-lib';

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dependencies for the app to read user input and to return JSONs.
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend/dist')));

app.listen(port, () => {
    console.log(`App running on port ${port}`);
});

// END BOILERPLATE.

app.post('/api/service', async (req, res) => {
    try {
        await poolConnect; // Tests the pool connection before continuing.

        const { make, part, customer, injectors, ohm } = req.body;
        const processesRequest = await pool.request()
            .input('make', sql.VarChar(50), make)
            .input('part', sql.VarChar(50), part)
            .input('customer', sql.VarChar(50), customer)
            .input('ohm', sql.Decimal(8, 2), ohm)
            .input('datetime', sql.DateTime, new Date())
            .query(`INSERT INTO processes
                (make, part, customer, ohm, datetime)
                OUTPUT inserted.*
                VALUES
                (@make, @part, @customer, @ohm, @datetime)`);

        const injectorsRequest = pool.request();
        let sqlString = `INSERT INTO injectors 
            (process_id, injector_serial, duty_100_before, duty_100_after, 
            duty_50_before, duty_50_after, idle_before, idle_after)
            VALUES `;
        const values = [];

        for (let i = 0; i < injectors.length; i++) {
            injectorsRequest.input(`processId${i}`, sql.Int, parseInt(processesRequest.recordset[0].process_id));
            injectorsRequest.input(`injectorSerial${i}`, sql.VarChar(50), injectors[i].injectorSerial);
            injectorsRequest.input(`duty100Before${i}`, sql.Int, parseInt(injectors[i].duty100Before));
            injectorsRequest.input(`duty100After${i}`, sql.Int, parseInt(injectors[i].duty100After));
            injectorsRequest.input(`duty50Before${i}`, sql.Int, parseInt(injectors[i].duty50Before));
            injectorsRequest.input(`duty50After${i}`, sql.Int, parseInt(injectors[i].duty50After));
            injectorsRequest.input(`idleBefore${i}`, sql.Decimal(10, 2), parseFloat(injectors[i].idleBefore));
            injectorsRequest.input(`idleAfter${i}`, sql.Decimal(10, 2), parseFloat(injectors[i].idleAfter));
            values.push(`(@processId${i}, @injectorSerial${i}, @duty100Before${i}, @duty100After${i},
            @duty50Before${i}, @duty50After${i}, @idleBefore${i}, @idleAfter${i})`);
        }

        sqlString += values.join(', ');
        const result = await injectorsRequest.query(sqlString);
        return res.status(200).json({ processId: processesRequest.recordset[0].process_id });
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


        const injectors = results.recordset;
        injectors.forEach((injector, index) => {
            sheet.getCell(`A${index + 7}`).value = injector.injector_serial;
            sheet.getCell(`B${index + 7}`).value = parseInt(injector.duty_100_before, 10);
            sheet.getCell(`C${index + 7}`).value = parseInt(injector.duty_100_after, 10);
            sheet.getCell(`D${index + 7}`).value = parseInt(injector.duty_50_before, 10);
            sheet.getCell(`E${index + 7}`).value = parseInt(injector.duty_50_after, 10);
            sheet.getCell(`F${index + 7}`).value = parseInt(injector.idle_before, 10);
            sheet.getCell(`G${index + 7}`).value = parseInt(injector.idle_after, 10);
        });

        const process = results2.recordset[0];
        sheet.getCell('B2').value = process.make;
        sheet.getCell('B3').value = process.part;
        sheet.getCell('J3').value = process.ohm;
        sheet.getCell('G1').value = process.process_id;
        sheet.getCell('J1').value = process.datetime;

        const names = [
            'duty_100',
            'duty_50',
            'idle'
        ];

        for (let i = 0; i < names.length; i++) {
            const minBefore = Math.min(...injectors.map(injector => injector[`${names[i]}_before`]));
            const maxBefore = Math.max(...injectors.map(injector => injector[`${names[i]}_before`]));
            const minAfter = Math.min(...injectors.map(injector => injector[`${names[i]}_after`]));
            const maxAfter = Math.max(...injectors.map(injector => injector[`${names[i]}_after`]));
            sheet.getRow(21).getCell(2 + i * 2).value = minBefore;
            sheet.getRow(22).getCell(2 + i * 2).value = maxBefore;
            sheet.getRow(23).getCell(2 + i * 2).value = maxBefore - minBefore;
            sheet.getRow(21).getCell(3 + i * 2).value = minAfter;
            sheet.getRow(22).getCell(3 + i * 2).value = maxAfter;
            sheet.getRow(23).getCell(3 + i * 2).value = maxAfter - minAfter;
        }

        // Sets the header so that the Excel file is processed correctly.
        // res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        // res.setHeader('Content-Disposition', 'attachment; filename="Services.xlsx"');

        await workbook.xlsx.writeFile('./src/assets/reportoutput.xlsx');

        // Converts the report to a PDF so that it may be inserted into the main PDF.
        await new Promise(resolve =>
            exec(`"C:\\Program Files\\LibreOffice\\program\\soffice" --headless --invisible --convert-to pdf "${path.resolve('./src/assets/reportoutput.xlsx')}" --outdir "${path.resolve('./src/assets')}"`, (error, stdout, stderr) => {
                if (error) {
                    console.log(error);
                }
                console.log(stdout || stderr);
                resolve();
            })
        );

        const duty100 = {
            label: 'Duty 100 Before',
            data: injectors.map(injector => injector.duty_100_before),
            label2: 'Duty 100 After',
            data2: injectors.map(injector => injector.duty_100_after)
        }
        const duty50 = {
            label: 'Duty 50 Before',
            data: injectors.map(injector => injector.duty_50_before),
            label2: 'Duty 50 After',
            data2: injectors.map(injector => injector.duty_50_after)
        }
        const idle = {
            label: 'Idle Before',
            data: injectors.map(injector => injector.idle_before),
            label2: 'Idle After',
            data2: injectors.map(injector => injector.idle_after)
        }

        const duty100Buffer = await generateChartBuffer(duty100);
        const duty50Buffer = await generateChartBuffer(duty50);
        const idleBuffer = await generateChartBuffer(idle);

        const buffers = [
            duty100Buffer,
            duty50Buffer,
            idleBuffer
        ];

        const reportOutputPdfPath = './src/assets/reportoutput.pdf';

        // Trims the first page, since the PDF has an extra blank page tacked onto its end.
        await trimFirstPage(reportOutputPdfPath);

        // Adds the three charts to the PDF.
        await addChartsToPdf(reportOutputPdfPath, 'finalreport.pdf', buffers);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=reportoutput.pdf');
        return res.status(200).sendFile(path.resolve('./finalreport.pdf'));
    } catch (err) {
        console.log(err);
        return res.status(500).json(err);
    }
});

app.get('/api/processes', async (_req, res) => {
    try {
        await poolConnect;
        const request = pool.request();
        const results = await request.query('SELECT * FROM processes ORDER BY process_id DESC');
        const processes = results.recordset;
        return res.status(200).json({ processes });
    } catch (err) {
        console.log(err.stack);
        return res.status(500).json({ err, message: 'Something went wrong with the processes call.' });
    }
})

const chartWidth = 210;
const chartHeight = 126;
const ratio = 10 / 7;

const chartJSTool = new ChartJSNodeCanvas({ width: chartWidth * ratio, height: chartHeight * ratio, backgroundColour: 'white' });

async function generateChartBuffer(data) {
    const configuration = {
        type: 'bar',
        data: {
            labels: [...data.data.map((_, i) => i + 1)],
            datasets: [
                {
                    label: data.label,
                    data: data.data,
                    backgroundColor: 'rgb(255, 192, 0)'
                },
                {
                    label: data.label2,
                    data: data.data2,
                    backgroundColor: 'green'
                }
            ]
        }
    };

    const image = await chartJSTool.renderToBuffer(configuration);
    return image;
}

async function addChartsToPdf(templatePath, outputPath, chartBuffers) {
    // Loads existing PDF
    const existingPdfBytes = fs.readFileSync(templatePath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);

    // Adds charts as an image on the first page
    const pngImages = [];
    for (let i = 0; i < chartBuffers.length; i++) {
        pngImages.push(await pdfDoc.embedPng(chartBuffers[i]));
    }
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];

    const padding = 10;
    const chartX = 512;
    const bottomMargin = 64;

    // Places image at exact coordinates.
    firstPage.drawImage(pngImages[0], {
        x: chartX,
        y: chartHeight * 2 + padding * 2 + bottomMargin,
        width: chartWidth,
        height: chartHeight,
    });
    firstPage.drawImage(pngImages[1], {
        x: chartX,
        y: chartHeight + padding + bottomMargin,
        width: chartWidth,
        height: chartHeight,
    });
    firstPage.drawImage(pngImages[2], {
        x: chartX,
        y: bottomMargin,
        width: chartWidth,
        height: chartHeight,
    });

    // Saves the modified PDF
    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(outputPath, pdfBytes);
}

async function trimFirstPage(reportPath) {
    const existingPdfBytes = fs.readFileSync(reportPath);

    // Load into pdf-lib
    const pdfDoc = await PDFDocument.load(existingPdfBytes);

    // Create a new PDF
    const newPdf = await PDFDocument.create();

    // Copy only the first page
    const [firstPage] = await newPdf.copyPages(pdfDoc, [0]);
    newPdf.addPage(firstPage);

    // Save to file
    const pdfBytes = await newPdf.save();
    fs.writeFileSync(reportPath, pdfBytes);
}