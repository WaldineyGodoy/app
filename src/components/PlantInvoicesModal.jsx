import React, { useState } from 'react';
import { X, FileText, Download } from 'lucide-react';
import './PlantInvoicesModal.css';

const PlantInvoicesModal = ({ isOpen, onClose, usina }) => {
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

    if (!isOpen || !usina) return null;

    // Mock Invoices - In real app, fetch based on usina.id and selectedMonth
    const mockInvoices = [
        { id: 1, uc: '3049281', name: 'Padaria Central', val: 1250.00, status: 'Pago' },
        { id: 2, uc: '8829102', name: 'Mercado Silva', val: 3420.50, status: 'Pendente' },
    ];

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content invoices-modal" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose}>
                    <X size={24} />
                </button>

                <header className="invoices-header">
                    <div>
                        <h2>Faturamento</h2>
                        <p>Usina: {usina.name}</p>
                    </div>

                    <div className="month-selector">
                        <label>Mês de Referência:</label>
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                        />
                    </div>
                </header>

                <div className="invoices-list-container">
                    <table className="invoices-table">
                        <thead>
                            <tr>
                                <th>UC</th>
                                <th>Cliente</th>
                                <th>Valor</th>
                                <th>Status</th>
                                <th align="right">Ação</th>
                            </tr>
                        </thead>
                        <tbody>
                            {mockInvoices.map(inv => (
                                <tr key={inv.id}>
                                    <td>{inv.uc}</td>
                                    <td>{inv.name}</td>
                                    <td className="value-col">
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(inv.val)}
                                    </td>
                                    <td>
                                        <span className={`status-badge ${inv.status === 'Pago' ? 'green' : 'yellow'}`}>
                                            {inv.status}
                                        </span>
                                    </td>
                                    <td align="right">
                                        <button className="download-btn" title="Baixar Fatura">
                                            <Download size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default PlantInvoicesModal;
