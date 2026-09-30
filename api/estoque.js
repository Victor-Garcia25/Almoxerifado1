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
        // BUSCAR ESTOQUE E HISTÓRICO
        if (req.method === 'GET') {
            const { buscar } = req.query;
            
            if (buscar === 'historico') {
                const historico = await sql`SELECT * FROM historico_almoxerifado ORDER BY data_movimentacao DESC LIMIT 100`;
                return res.status(200).json(historico);
            }

            const resultado = await sql`SELECT * FROM almoxerifado ORDER BY nome ASC`;
            return res.status(200).json(resultado);
        }

        // CADASTRAR NOVO PRODUTO
        if (req.method === 'POST') {
            const { codigo, nome, categoria, quantidade, quantidade_minima, localizacao } = req.body;
            await sql`
                INSERT INTO almoxerifado (codigo, nome, categoria, quantidade, quantidade_minima, localizacao)
                VALUES (${codigo}, ${nome}, ${categoria}, ${quantidade}, ${quantidade_minima}, ${localizacao})
            `;
            return res.status(201).json({ mensagem: 'Item adicionado!' });
        }

        // SISTEMA DE ENTRADA E SAÍDA COM HISTÓRICO
        if (req.method === 'PUT') {
            const { id, valor, frota, utilizacao } = req.body;
            const tipo = valor > 0 ? 'ENTRADA' : 'SAIDA';
            const qtdMovimentada = Math.abs(valor);

            // 1. Busca os dados atuais do produto para registrar no histórico
            const produto = await sql`SELECT codigo, nome, quantidade FROM almoxerifado WHERE id = ${id}`;
            if (produto.length === 0) return res.status(404).json({ erro: 'Produto não encontrado' });

            // Impedir saída se não houver estoque suficiente
            if (tipo === 'SAIDA' && produto.quantidade < qtdMovimentada) {
                return res.status(400).json({ erro: 'Estoque insuficiente para esta saída!' });
            }

            // 2. Atualiza a quantidade no estoque
            await sql`
                UPDATE almoxerifado 
                SET quantidade = quantidade + ${valor} 
                WHERE id = ${id}
            `;

            // 3. Salva a movimentação na tabela de histórico
            await sql`
                INSERT INTO historico_almoxerifado (produto_id, codigo_produto, nome_produto, tipo_movimentacao, quantidade, frota, utilizacao)
                VALUES (${id}, ${produto[0].codigo}, ${produto[0].nome}, ${tipo}, ${qtdMovimentada}, ${tipo === 'SAIDA' ? frota : null}, ${tipo === 'SAIDA' ? utilizacao : null})
            `;

            return res.status(200).json({ mensagem: 'Movimentação registrada com sucesso!' });
        }

        return res.status(405).json({ erro: 'Método não permitido' });
    } catch (erro) {
        console.error(erro);
        return res.status(500).json({ erro: 'Erro interno', detalhes: erro.message });
    }
}
