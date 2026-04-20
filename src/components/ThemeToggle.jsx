import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useUI } from '../contexts/UIContext';

const ThemeToggle = () => {
    const { theme, toggleTheme } = useUI();

    return (
        <button
            onClick={toggleTheme}
            className="theme-toggle-btn"
            title={theme === 'light' ? 'Ativar Modo Escuro' : 'Ativar Modo Claro'}
        >
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            <span>{theme === 'light' ? 'Escuro' : 'Claro'}</span>
            
            <style>{`
                .theme-toggle-btn {
                    position: fixed;
                    top: 2.5rem;
                    right: 2.5rem;
                    background: var(--bg-card);
                    color: var(--text-main);
                    border: 1px solid var(--border-ui);
                    padding: 0.85rem 1.5rem;
                    border-radius: 50px;
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    font-weight: 700;
                    font-size: 0.9rem;
                    cursor: pointer;
                    box-shadow: var(--shadow-modal);
                    transition: all 0.3s ease;
                    z-index: 2000;
                }

                .theme-toggle-btn:hover {
                    transform: translateY(-4px);
                    border-color: var(--primary);
                    color: var(--primary);
                }

                @media (max-width: 768px) {
                    .theme-toggle-btn {
                        top: 1.5rem;
                        right: 1.5rem;
                        padding: 0.85rem;
                    }
                    .theme-toggle-btn span {
                        display: none;
                    }
                }
            `}</style>
        </button>
    );
};

export default ThemeToggle;
