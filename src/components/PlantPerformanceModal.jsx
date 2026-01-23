import React from 'react';
import { X, BarChart2 } from 'lucide-react';
import './PlantPerformanceModal.css'; // Reusing similar modal styles or creating new

const PlantPerformanceModal = ({ isOpen, onClose, usina }) => {
    if (!isOpen || !usina) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content performance-modal" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose}>
                    <X size={24} />
                </button>

                <header className="performance-header">
                    <div className="icon-wrapper">
                        <BarChart2 size={32} color="#FF6600" />
                    </div>
                    <div>
                        <h2>Desempenho da Usina</h2>
                        <p>{usina.name}</p>
                    </div>
                </header>

                <div className="performance-body">
                    <div className="placeholder-chart">
                        <p>Gráficos de Desempenho em Construção...</p>
                        {/* Placeholder visual */}
                        <div style={{ width: '100%', height: '200px', background: '#f5f5f5', borderRadius: '8px', marginTop: '1rem' }}></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PlantPerformanceModal;
