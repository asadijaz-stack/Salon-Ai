const fs = require('fs');
let code = fs.readFileSync('src/components/BillingScreen.tsx', 'utf8');

// 1. Add state variables
code = code.replace(
  '  const [isSubmitting, setIsSubmitting] = useState(false);',
  '  const [isSubmitting, setIsSubmitting] = useState(false);\n  const [isAccountControlOpen, setIsAccountControlOpen] = useState(false);\n  const [controlTab, setControlTab] = useState(\'pending\');'
);

// 2. Replace Header and Buttons
code = code.replace(
  /<div className="mb-6 flex justify-between items-start">[\s\S]*?<\/div>\s*<\/div>/,
  `<div className="mb-6 flex justify-between items-start">
        <div>
          <h2 className="text-xl font-bold text-[#37352F] flex items-center space-x-2">
            <CreditCard className="w-6 h-6 text-rose-800" />
            <span>SalonAI Software Subscription & Billing</span>
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Subscription status and manual payment ledger for {business.name}.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {isSuperAdmin && (
            <button
              onClick={() => setIsAccountControlOpen(!isAccountControlOpen)}
              className="bg-white border border-[#EDEDEB] hover:bg-gray-50 text-[#37352F] px-4 py-2 rounded-xl text-xs font-semibold shadow-xs flex items-center space-x-2 transition-colors"
            >
              <ShieldCheck className="w-4 h-4 text-rose-600" />
              <span>{isAccountControlOpen ? 'Back to Billing' : 'Account Controls'}</span>
            </button>
          )}
          {onOpenOnboarding && (
            <button
              onClick={onOpenOnboarding}
              className="bg-[#37352F] hover:bg-black text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-xs flex items-center space-x-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Salon</span>
            </button>
          )}
        </div>
      </div>`
);

// 3. Remove the old inline Admin Directory block completely
code = code.replace(
  /      \{isSuperAdmin && \([\s\S]*?Master Admin: Platform Salons Directory[\s\S]*?<\/div>\n      \)\}\n/,
  ''
);

// 4. Extract the rest of the component
const gridStart = code.indexOf('<div className="grid grid-cols-1 lg:grid-cols-12 gap-6">');
const gridEnd = code.lastIndexOf('</div>\n    </div>'); // The end of the grid div and the main container div

if (gridStart !== -1 && gridEnd !== -1) {
  const normalBillingContent = code.slice(gridStart, gridEnd);
  
  const accountControlContent = `
      {isAccountControlOpen ? (
        <div className="bg-[#37352F] border border-[#2D2B26] rounded-2xl shadow-xs relative overflow-hidden">
          <div className="border-b border-white/10 p-4 flex space-x-4">
            <button
              onClick={() => setControlTab('pending')}
              className={\`text-sm font-semibold px-4 py-2 rounded-lg transition-colors \${
                controlTab === 'pending' ? 'bg-amber-500/20 text-amber-300' : 'text-gray-400 hover:text-white'
              }\`}
            >
              Pending Applications
            </button>
            <button
              onClick={() => setControlTab('active_trial')}
              className={\`text-sm font-semibold px-4 py-2 rounded-lg transition-colors \${
                controlTab === 'active_trial' ? 'bg-emerald-500/20 text-emerald-300' : 'text-gray-400 hover:text-white'
              }\`}
            >
              Active / Trial
            </button>
            <button
              onClick={() => setControlTab('cancelled')}
              className={\`text-sm font-semibold px-4 py-2 rounded-lg transition-colors \${
                controlTab === 'cancelled' ? 'bg-red-500/20 text-red-300' : 'text-gray-400 hover:text-white'
              }\`}
            >
              Cancelled
            </button>
          </div>
          <div className="p-6 space-y-3 min-h-[400px]">
            {allBusinesses
              .filter((biz) => {
                if (controlTab === 'pending') return biz.subscriptionStatus === 'pending';
                if (controlTab === 'active_trial') return biz.subscriptionStatus === 'active' || biz.subscriptionStatus === 'trial';
                if (controlTab === 'cancelled') return biz.subscriptionStatus === 'cancelled';
                return false;
              })
              .map((biz) => (
                <div key={biz.id} className="bg-white/5 p-4 rounded-xl border border-white/10 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white text-sm flex items-center space-x-2">
                      <span>{biz.name}</span>
                      <span
                        className={\`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider \${
                          biz.subscriptionStatus === 'active'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : biz.subscriptionStatus === 'pending'
                            ? 'bg-amber-500/20 text-amber-300'
                            : biz.subscriptionStatus === 'trial'
                            ? 'bg-blue-500/20 text-blue-300'
                            : 'bg-red-500/20 text-red-300'
                        }\`}
                      >
                        {biz.subscriptionStatus}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      Owner: {biz.ownerName} | Email: {biz.ownerEmail} | Phone: {biz.phone}
                    </div>
                    {biz.subscriptionStatus === 'pending' && (biz.requestedPlan || biz.paymentProof) && (
                      <div className="mt-2 text-xs p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg inline-block">
                        {biz.requestedPlan && (
                          <div className="font-medium text-amber-300">
                            Requested: {biz.requestedPlan === 'paid' ? 'Active Subscription' : '14-Day Free Trial'}
                          </div>
                        )}
                        {biz.paymentProof && (
                          <div className="text-amber-200 mt-0.5 font-mono">
                            Proof: {biz.paymentProof}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center space-x-3">
                    <label className="text-xs text-gray-400 font-medium">Set Status:</label>
                    <select
                      value={biz.subscriptionStatus}
                      onChange={async (e) => {
                        const newStatus = e.target.value;
                        const res = await fetch(\`/api/business/\${biz.id}\`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ subscriptionStatus: newStatus }),
                        });
                        if (res.ok) {
                          const updatedBiz = await res.json();
                          if (onUpdateBusiness) onUpdateBusiness(updatedBiz);
                        }
                      }}
                      className="bg-black text-white text-xs p-2 rounded-lg border border-white/20 focus:outline-none focus:border-rose-400"
                    >
                      <option value="pending">Pending</option>
                      <option value="trial">Trial</option>
                      <option value="active">Active</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>
              ))}
              {allBusinesses.filter((biz) => {
                if (controlTab === 'pending') return biz.subscriptionStatus === 'pending';
                if (controlTab === 'active_trial') return biz.subscriptionStatus === 'active' || biz.subscriptionStatus === 'trial';
                if (controlTab === 'cancelled') return biz.subscriptionStatus === 'cancelled';
                return false;
              }).length === 0 && (
                <div className="text-center py-12 text-gray-500 text-sm">
                  No salons found in this category.
                </div>
              )}
          </div>
        </div>
      ) : (
        <>
        ` + normalBillingContent + `
        </>
      )}`;

  code = code.slice(0, gridStart) + accountControlContent + code.slice(gridEnd);
} else {
  console.log("Could not find grid bounds!");
}

fs.writeFileSync('src/components/BillingScreen.tsx', code);
console.log("Done");
