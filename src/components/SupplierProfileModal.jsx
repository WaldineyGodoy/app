import React from 'react';
import { X, User, MapPin, Phone, Mail, FileText, CreditCard, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import './SupplierProfileModal.css';

const SupplierProfileModal = ({ isOpen, onClose, supplier }) => {
    if (!isOpen || !supplier) return null;

    const formatCNPJ = (val) => {
        if (!val) return 'Não informado';
        return val.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
    };

    const formatCPF = (val) => {
        if (!val) return 'Não informado';
        return val.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="modal-overlay" onClick={onClose}>
                    <motion.div
                        className="modal-content profile-modal"
                        onClick={(e) => e.stopPropagation()}
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    >
                        <button className="modal-close" onClick={onClose}>
                            <X size={24} />
                        </button>

                        <div className="profile-header-main">
                            <div className="avatar-large">
                                <User size={54} strokeWidth={1.5} />
                            </div>
                            <div className="header-info">
                                <h2>Perfil do Fornecedor</h2>
                                <span className={`status-badge ${supplier.status?.toLowerCase().replace(' ', '-') || 'ativo'}`}>
                                    {supplier.status || 'Ativo'}
                                </span>
                            </div>
                        </div>

                        <div className="profile-sections-grid">
                            {/* Dados da Empresa */}
                            <section className="profile-section">
                                <h3 className="section-title"><ShieldCheck size={20} /> Dados Jurídicos</h3>
                                <div className="info-list">
                                    <div className="info-item">
                                        <label>Razão Social</label>
                                        <p>{supplier.name || 'N/A'}</p>
                                    </div>
                                    <div className="info-item">
                                        <label>CNPJ</label>
                                        <p>{formatCNPJ(supplier.cnpj)}</p>
                                    </div>
                                    <div className="info-item">
                                        <label>E-mail Corporativo</label>
                                        <p><Mail size={14} /> {supplier.email || 'N/A'}</p>
                                    </div>
                                    <div className="info-item">
                                        <label>Telefone</label>
                                        <p><Phone size={14} /> {supplier.phone || 'N/A'}</p>
                                    </div>
                                </div>
                            </section>

                            {/* Sócio Responsável */}
                            <section className="profile-section">
                                <h3 className="section-title"><User size={20} /> Representante Legal</h3>
                                <div className="info-list">
                                    <div className="info-item">
                                        <label>Nome do Sócio</label>
                                        <p>{supplier.legal_partner_name || 'Não informado'}</p>
                                    </div>
                                    <div className="info-item">
                                        <label>CPF do Sócio</label>
                                        <p>{formatCPF(supplier.legal_partner_cpf)}</p>
                                    </div>
                                </div>
                            </section>

                            {/* Endereço */}
                            <section className="profile-section full-width">
                                <h3 className="section-title"><MapPin size={20} /> Endereço Sede</h3>
                                <div className="address-info">
                                    {supplier.address ? (
                                        <p>
                                            {supplier.address.rua}, {supplier.address.numero}
                                            {supplier.address.complemento && ` - ${supplier.address.complemento}`}<br />
                                            {supplier.address.bairro} - {supplier.address.cidade}/{supplier.address.uf}<br />
                                            CEP: {supplier.address.cep}
                                        </p>
                                    ) : (
                                        <p className="text-muted">Endereço não cadastrado.</p>
                                    )}
                                </div>
                            </section>

                            {/* Dados Financeiros */}
                            <section className="profile-section full-width">
                                <h3 className="section-title"><CreditCard size={20} /> Dados de Recebimento</h3>
                                <div className="financial-grid">
                                    <div className="info-item">
                                        <label>Tipo de Chave PIX</label>
                                        <p className="text-capitalize">{supplier.pix_key_type || 'Não informado'}</p>
                                    </div>
                                    <div className="info-item">
                                        <label>Chave PIX</label>
                                        <p className="pix-key-display">{supplier.pix_key || 'Não informado'}</p>
                                    </div>
                                </div>
                            </section>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default SupplierProfileModal;
