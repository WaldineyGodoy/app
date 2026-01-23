import { supabase } from './supabaseClient';

/**
 * Checks if the user (by email) exists in the Subscribers (Assinantes) table.
 * Assumes the table is 'subscribers' or 'assinantes' based on diagnosis. 
 * Diagnosis showed 'subscribers'.
 * @param {string} email 
 * @returns {Promise<boolean>}
 */
export const checkSubscriberAccess = async (email) => {
    if (!email) return false;
    try {
        const { data, error } = await supabase
            .from('subscribers')
            .select('id')
            .eq('email', email)
            .maybeSingle();

        if (error) {
            console.error('Error checking subscriber access:', error);
            return false;
        }
        return !!data;
    } catch (err) {
        console.error('Unexpected error checking subscriber access:', err);
        return false;
    }
};

/**
 * Checks if the user (by email) exists in the Originators/Ambassadors (Embaixadores) table.
 * Diagnosis showed 'originators_v2'.
 * @param {string} email 
 * @returns {Promise<boolean>}
 */
export const checkOriginatorAccess = async (email) => {
    if (!email) return false;
    try {
        const { data, error } = await supabase
            .from('originators_v2')
            .select('id')
            .eq('email', email)
            .maybeSingle();

        if (error) {
            console.error('Error checking originator access:', error);
            return false;
        }
        return !!data;
    } catch (err) {
        console.error('Unexpected error checking originator access:', err);
        return false;
    }
};

/**
 * Checks if the user (by email) exists in the Suppliers/Power Plants Owners (Donos de Usinas) table.
 * Diagnosis showed 'suppliers'.
 * @param {string} email 
 * @returns {Promise<boolean>}
 */
export const checkSupplierAccess = async (email) => {
    if (!email) return false;
    try {
        const { data, error } = await supabase
            .from('suppliers')
            .select('id')
            .eq('email', email)
            .maybeSingle();

        if (error) {
            console.error('Error checking supplier access:', error);
            return false;
        }
        return !!data;
    } catch (err) {
        console.error('Unexpected error checking supplier access:', err);
        return false;
    }
};
