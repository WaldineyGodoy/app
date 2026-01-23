import React from 'react';
import {
    LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import './DashboardCharts.css';

// Chart 1: Savings Comparison (Line Chart)
export const SavingsChart = ({ data }) => {
    return (
        <div className="chart-container">
            <h3 className="chart-title">Economia: Concessionária vs B2W</h3>
            <div className="chart-wrapper">
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#95a5a6', fontSize: 12 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#95a5a6', fontSize: 12 }} />
                        <Tooltip
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        />
                        <Legend />
                        <Line
                            type="monotone"
                            dataKey="concessionaireValue"
                            name="Valor na Concessionária"
                            stroke="#95a5a6"
                            strokeWidth={2}
                            dot={{ r: 4 }}
                            activeDot={{ r: 6 }}
                            strokeDasharray="5 5"
                        />
                        <Line
                            type="monotone"
                            dataKey="b2wValue"
                            name="Valor B2W"
                            stroke="#FF6600"
                            strokeWidth={3}
                            dot={{ r: 4 }}
                            activeDot={{ r: 6 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

// Chart 2: Consumption History (Bar Chart)
export const ConsumptionChart = ({ data }) => {
    return (
        <div className="chart-container">
            <h3 className="chart-title">Histórico de Consumo (kWh)</h3>
            <div className="chart-wrapper">
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#95a5a6', fontSize: 12 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#95a5a6', fontSize: 12 }} />
                        <Tooltip
                            cursor={{ fill: 'rgba(255, 102, 0, 0.05)' }}
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        />
                        <Bar
                            dataKey="consumption"
                            name="Consumo (kWh)"
                            fill="#FF6600"
                            radius={[4, 4, 0, 0]}
                            barSize={40}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
