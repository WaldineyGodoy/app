import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import './KPICard.css';

const KPICard = ({ title, value, icon: Icon, trend }) => {
    // Trend logic (optional)
    const getTrendIcon = () => {
        if (!trend) return null;
        if (trend > 0) return <ArrowUpRight size={16} />;
        if (trend < 0) return <ArrowDownRight size={16} />;
        return <Minus size={16} />;
    };

    const getTrendColor = () => {
        if (!trend) return '#95a5a6';
        return trend > 0 ? '#2ecc71' : '#e74c3c';
    };

    return (
        <div className="kpi-card">
            <div className="kpi-icon-wrapper">
                <Icon size={24} color="#FF6600" />
            </div>
            <div className="kpi-content">
                <span className="kpi-title">{title}</span>
                <div className="kpi-value-row">
                    <span className="kpi-value">{value}</span>
                    {trend !== undefined && (
                        <span className="kpi-trend" style={{ color: getTrendColor() }}>
                            {getTrendIcon()}
                            {Math.abs(trend)}%
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default KPICard;
