import { supabase } from '../services/supabaseClient';

/**
 * Busca endereço pelo CEP usando VIACEP
 * @param {string} cep 
 * @returns {Promise<{ rua: string, bairro: string, cidade: string, uf: string, cep: string, ibge: string, erro?: boolean }>}
 */
export const fetchAddressByCep = async (cep) => {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) throw new Error('CEP inválido');

    const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
    const data = await response.json();

    if (data.erro) throw new Error('CEP não encontrado');

    return {
        rua: data.logradouro,
        bairro: data.bairro,
        cidade: data.localidade,
        uf: data.uf,
        cep: data.cep,
        ibge: data.ibge,
        complemento: data.complemento
    };
};

/**
 * Busca dados da oferta (Concessionária)
 */
export const fetchOfferData = async (ibge) => {
    const { data, error } = await supabase
        .from('Concessionaria')
        .select('*')
        .eq('"Cod. Ibge"', ibge)
        .single();
    if (error) {
        console.error('Error fetching offer:', error);
        return null;
    }
    return data;
};

/**
 * Busca dados do CPF/CNPJ usando API Gratis
 * @param {string} doc CPF ou CNPJ
 */
export const fetchCpfCnpjData = async (doc) => {
    const cleanDoc = doc.replace(/\D/g, '');
    const isCnpj = cleanDoc.length > 11;

    if (!isCnpj) {
        console.warn('Busca de CPF desabilitada temporariamente.');
        return { nome: '', doc: cleanDoc };
    } else {
        try {
            const response = await fetch(`https://publica.cnpj.ws/cnpj/${cleanDoc}`);
            if (!response.ok) throw new Error('Erro ao buscar CNPJ');

            const data = await response.json();
            const est = data.estabelecimento || {};
            const socio = data.socios && data.socios.length > 0 ? data.socios[0] : null;

            return {
                nome: data.razao_social,
                fantasia: est.nome_fantasia,
                doc: cleanDoc,
                email: est.email,
                telefone: est.ddd1 && est.telefone1 ? `(${est.ddd1}) ${est.telefone1}` : '',
                address: {
                    logradouro: est.tipo_logradouro ? `${est.tipo_logradouro} ${est.logradouro}` : est.logradouro,
                    numero: est.numero,
                    complemento: est.complemento,
                    bairro: est.bairro,
                    cep: est.cep,
                    uf: est.estado?.sigla,
                    municipio: est.cidade?.nome,
                    cidade: est.cidade?.nome
                },
                legal_partner: socio ? {
                    nome: socio.nome,
                    cpf: socio.cpf_cnpj_socio
                } : { nome: '', cpf: '' },
                raw: data
            };
        } catch (error) {
            console.error('Erro CNPJ (publica.cnpj.ws)', error);
            throw error;
        }
    }
}

export const manageAsaasCustomer = async (data) => {
    try {
        const { data: result, error } = await supabase.functions.invoke('manage-asaas-customer', {
            body: data
        });

        if (error) throw error;
        return result;
    } catch (error) {
        console.error('Erro Asaas Customer:', error);
        throw error;
    }
};

export const createAsaasCharge = async (id, type = 'invoice') => {
    const payload = type === 'invoice' ? { invoice_id: id } : { subscriber_id: id };

    const { data, error } = await supabase.functions.invoke('create-asaas-charge', {
        body: payload
    });

    if (error) throw error;
    return data;
};

/**
 * Envia mensagem via WhatsApp usando Evolution API (CRM Integration)
 * @param {string} phone Número destinatário (com DDI, ex: 5511999999999)
 * @param {string} text Texto da mensagem
 * @param {string} [mediaUrl] URL da imagem/video (opcional)
 * @param {string} [instanceName] Nome da instância (opcional, se não definido usa o padrão do CRM)
 */
export const sendWhatsapp = async (phone, text, mediaUrl, instanceName) => {
    try {
        const { data, error } = await supabase.functions.invoke('send-whatsapp', {
            body: {
                phone: phone ? phone.replace(/\D/g, '') : '',
                text,
                mediaUrl,
                instanceName
            }
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        return data;
    } catch (error) {
        console.error('Erro ao enviar WhatsApp:', error);
        throw error;
    }
};
