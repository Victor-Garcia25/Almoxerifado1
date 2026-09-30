import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
    // Configuração obrigatória de cabeçalhos para evitar travamentos de CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Validação da variável de ambiente
    if (!process.env.DATABASE_URL) {
        return res.status(500).json({ erro: 'A variável DATABASE_URL não está configurada na Vercel.' });
    }

    try {
        const sql = neon(process.env.DATABASE_URL);

        // ROTA GET: BUSCAR ESTOQUE OU HISTÓRICO
        if (req.method === 'GET') {
            const { buscar } = req.query;
            
            if (buscar === 'historico') {
                try {
                    const historico = await sql`SELECT * FROM historico_almoxerifado ORDER BY data_movimentacao DESC LIMIT 100`;
                    return res.status(200).json(Array.isArray(historico) ? historico : []);
                } catch (errHistorico) {
                    console.error('Tabela de histórico não encontrada ou erro:', errHistorico.message);
                    return res.status(200).json([]); // Retorna lista vazia segura para não travar o frontend
                }
            }

            const resultado = await sql`SELECT * FROM almoxerifado ORDER BY nome ASC`;
            return res.status(200).json(Array.isArray(resultado) ? resultado : []);
        }

        // ROTA POST: CADASTRAR PRODUTO
        if (req.method === 'POST') {
            const { codigo, nome, categoria, quantidade, quantidade_minima, localizacao } = req.body;
            await sql`
                INSERT INTO almoxerifado (codigo, nome, categoria, quantidade, quantidade_minima, localizacao)
                VALUES (${codigo}, ${nome}, ${categoria}, ${quantidade}, ${quantidade_minima}, ${localizacao})
            `;
            return res.status(201).json({ mensagem: 'Item adicionado!' });
        }

        // ROTA PUT: MOVIMENTAÇÃO DE ENTRADA E SAÍDA
        if (req.method === 'PUT') {
            const { id, valor, frota, utilizacao } = req.body;
            const tipo = valor > 0 ? 'ENTRADA' : 'SAIDA';
            const qtdMovimentada = Math.abs(valor);

            const produto = await sql`SELECT codigo, nome, quantidade FROM almoxerifado WHERE id = ${id}`;
            if (!produto || produto.length === 0) {
                return res.status(404).json({ erro: 'Produto não encontrado no banco.' });
            }

            if (tipo === 'SAIDA' && produto[0].quantidade < qtdMovimentada) {
                return res.status(400).json({ erro: 'Estoque insuficiente para esta saída!' });
            }

            // Atualiza o estoque principal
            await sql`
                UPDATE almoxerifado 
                SET quantidade = quantidade + ${valor} 
                WHERE id = ${id}
            `;

            // Grava no histórico se a tabela existir
            try {
                await sql`
                    INSERT INTO historico_almoxerifado (produto_id, codigo_produto, nome_produto, tipo_movimentacao, quantidade, frota, utilizacao)
                    VALUES (${id}, ${produto[0].codigo}, ${produto[0].nome}, ${tipo}, ${qtdMovimentada}, ${tipo === 'SAIDA' ? frota : null}, ${tipo === 'SAIDA' ? utilizacao : null})
                `;
            } catch (errHistIns) {
                console.error('Erro ao gravar histórico:', errHistIns.message);
            }

            return res.status(200).json({ mensagem: 'Movimentação registrada com sucesso!' });
        }

        return res.status(405).json({ erro: 'Método não permitido' });
    } catch (erro) {
        console.error('Erro geral no servidor backend:', erro);
        return res.status(500).json({ erro: 'Erro interno no banco de dados', detalhes: erro.message });
    }
}
