import { supabase } from '../lib/supabase';

export const ledgerService = {
    /**
     * Busca o saldo real da conta de comissão do embaixador.
     * @param {string} originatorId 
     */
    async getOriginatorBalance(originatorId) {
        try {
            // Usa a função RPC de backend para cálculo real
            const { data, error } = await supabase
                .rpc('get_financial_balance', {
                    p_entity_id: originatorId,
                    p_entity_type: 'originator'
                });

            if (error) throw error;
            return { balance: Number(data) || 0, id: originatorId };
        } catch (err) {
            console.error('Erro ao buscar saldo do embaixador:', err);
            return { balance: 0, id: null };
        }
    },

    /**
     * Busca o saldo 'A Pagar Usina' para o fornecedor.
     * @param {string} supplierId 
     */
    async getSupplierBalance(supplierId) {
        try {
            // Updated to match PlantLedgerModal logic directly from view_ledger_enriched
            const { data, error } = await supabase
                .from('view_ledger_enriched')
                .select('amount, created_at, reference_type')
                .eq('reference_id', supplierId)
                .eq('account_code', '2.1.1');

            if (error) throw error;
            
            const startDate = new Date('2026-06-01T00:00:00Z');
            const endDate = new Date('2026-06-11T03:00:00Z');
            
            const filteredData = (data || []).filter(item => {
                const itemDate = new Date(item.created_at);
                const isWithinPeriod = itemDate >= startDate && itemDate <= endDate;
                if (isWithinPeriod) {
                    return item.reference_type === 'SUPPLIER';
                }
                return true;
            });
            
            const balance = filteredData.reduce((acc, curr) => acc + (curr.amount || 0), 0) || 0;
            return { balance: Math.abs(balance), id: supplierId };
        } catch (err) {
            console.error('Erro ao buscar saldo do fornecedor:', err);
            return { balance: 0, id: null };
        }
    },

    /**
     * Busca o saldo real da conta de uma usina específica.
     * @param {string} usinaId 
     */
    async getUsinaBalance(usinaId) {
        try {
            const { data, error } = await supabase
                .from('view_ledger_enriched')
                .select('amount')
                .eq('usina_id', usinaId)
                .eq('account_code', '2.1.1');

            if (error) throw error;
            
            const balance = data?.reduce((acc, curr) => acc + (curr.amount || 0), 0) || 0;
            return { balance: Math.abs(balance), id: usinaId };
        } catch (err) {
            console.error('Erro ao buscar saldo da usina:', err);
            return { balance: 0, id: null };
        }
    },

    /**
     * Busca o extrato de movimentações de uma conta.
     * @param {string} entityId (Account ID ou Owner ID dependendo do contexto, aqui vamos usar Entity ID)
     * @param {string} type 'originator' ou 'supplier' (Adicionado para suportar nova lógica)
     */
    async getStatement(entityId, type = 'originator') {
        if (!entityId) return [];

        try {
            // Se o ID passado for um UUID de conta ledger antiga, isso falharia.
            // Mas o frontend agora deve passar o ID do User/Originator.
            // Vamos assumir que, no contexto do dashboard, passamos o ID do Originator.

            const { data, error } = await supabase
                .rpc('get_financial_statement', {
                    p_entity_id: entityId,
                    p_entity_type: type
                });

            if (error) throw error;
            return data || [];
        } catch (err) {
            console.error('Erro ao buscar extrato:', err);
            return [];
        }
    }
};
