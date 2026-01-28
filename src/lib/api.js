/* src/lib/api.js */
import { supabase } from '../services/supabaseClient';

export const fetchAddressByCep = async (cep) => {
    // Remove non-digits
    const cleanCep = cep.replace(/\D/g, '');

    if (cleanCep.length !== 8) {
        throw new Error('CEP inválido');
    }

    const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
    const data = await response.json();

    if (data.erro) {
        throw new Error('CEP não encontrado');
    }

    return {
        rua: data.logradouro,
        bairro: data.bairro,
        cidade: data.localidade,
        uf: data.uf,
        ibge: data.ibge,
        complemento: data.complemento
    };
};

export const fetchOfferData = async (ibge) => {
    const { data, error } = await supabase
        .from('Concessionaria') // Nome da tabela no Supabase
        .select('*')
        .eq('"Cod. Ibge"', ibge) // Importante: Aspas duplas pois o nome da coluna tem espaço/ponto
        .single(); // Espera apenas um resultado
    if (error) {
        console.error('Error fetching offer:', error);
        return null;
    }
    return data;
};
