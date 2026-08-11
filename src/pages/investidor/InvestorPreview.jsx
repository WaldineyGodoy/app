import React from 'react';
import InvestorPanel from './InvestorPanel';
import { supplier, usinas, cycles, entries, balance } from './preview.fixtures';

/** Rota só de desenvolvimento: o painel com dados de exemplo, sem autenticar. */
export default function InvestorPreview() {
    return (
        <InvestorPanel
            supplier={supplier}
            usinas={usinas}
            cycles={cycles}
            entries={entries}
            balance={balance}
            autoRedeem
            fetchedAt={new Date('2026-08-10T13:40:00')}
            onReload={() => { }}
            onSignOut={() => { }}
            onRedeem={() => { }}
        />
    );
}
