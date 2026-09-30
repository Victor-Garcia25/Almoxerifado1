import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        if (req.method === 'GET') {
            const resultado = await sql`SELECT * FROM almoxerifado ORDER BY nome ASC`;
            return res.status(200).json(resultado);
        }

        if (req.method === 'POST') {
            const { codigo, nome, categoria, quantidade, quantidade_minima, localizacao } = req.body;
            await sql`
                INSERT INTO almoxerifado (codigo, nome, categoria, quantidade, quantidade_minima, localizacao)
                VALUES (${codigo}, ${nome}, ${categoria}, ${quantidade}, ${quantidade_minima}, ${localizacao})
            `;
            return res.status(201).json({ mensagem: 'Item adicionado com sucesso!' });
        }

        if (req.method === 'PUT') {
            const { id, valor } = req.body;
            await sql`
                UPDATE almoxerifado 
                SET quantidade = GREATEST(0, quantidade + ${valor}) 
                WHERE id = ${id}
            `;
            return res.status(200).json({ mensagem: 'Quantidade updated!' });
        }

        return res.status(405).json({ erro: 'Metodo nao permitido' });
    } catch (erro) {
        console.error(erro);
        return res.status(500).json({ erro: 'Erro interno', detalhes: erro.message });
    }
}
