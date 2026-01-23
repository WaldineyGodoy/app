import React from 'react';
import './RoleCard.css';

const RoleCard = ({ title, description, icon: Icon, color, onClick, buttonText }) => {
    return (
        <div
            className="role-card"
            onClick={onClick}
            style={{ '--card-accent-color': color }}
        >
            <div className="role-card-icon-wrapper" style={{ backgroundColor: color }}>
                <Icon color="#fff" size={32} />
            </div>
            <h3 className="role-card-title">{title}</h3>
            <p className="role-card-description">{description}</p>
            <button className="role-card-button" style={{ backgroundColor: color }}>
                {buttonText || 'Acessar'}
            </button>
        </div>
    );
};

export default RoleCard;
