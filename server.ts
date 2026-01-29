import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

const hipotecasFilePath = path.join(__dirname, 'hipotecas.json');

// Endpoint to get the current mortgages
app.get('/api/hipotecas', async (req, res) => {
    try {
        const data = await fs.readFile(hipotecasFilePath, 'utf-8');
        res.json(JSON.parse(data));
    } catch (error) {
        console.error('Error reading hipotecas.json:', error);
        res.status(500).send('Error reading hipotecas.json');
    }
});

// Endpoint to save the mortgages
app.post('/api/hipotecas', async (req, res) => {
    try {
        const newData = req.body;
        await fs.writeFile(hipotecasFilePath, JSON.stringify(newData, null, 2), 'utf-8');
        res.status(200).send('Hipotecas saved successfully');
    } catch (error) {
        console.error('Error writing to hipotecas.json:', error);
        res.status(500).send('Error writing to hipotecas.json');
    }
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
