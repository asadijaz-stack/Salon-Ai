const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Add fetchComplete state
code = code.replace(
  '  const [authInitialized, setAuthInitialized] = useState(false);',
  '  const [authInitialized, setAuthInitialized] = useState(false);\n  const [fetchComplete, setFetchComplete] = useState(false);'
);

// Update fetchBusinesses
code = code.replace(
  /    } catch \(e\) \{\n      console.error\('Error fetching businesses:', e\);\n    \}\n  \};/,
  \`    } catch (e) {
      console.error('Error fetching businesses:', e);
    } finally {
      setFetchComplete(true);
    }
  };\`
);

// Update useEffect for auth
code = code.replace(
  /  useEffect\(\(\) => \{\n    if \(user\) \{\n      fetchBusinesses\(\);\n    \} else \{\n      setBusinesses\(\[\]\);\n      setCurrentBusiness\(null\);\n    \}\n  \}, \[user\]\);/,
  \`  useEffect(() => {
    if (user) {
      setFetchComplete(false);
      fetchBusinesses();
    } else {
      setBusinesses([]);
      setCurrentBusiness(null);
      setFetchComplete(false);
    }
  }, [user]);\`
);

// Update renderContent
code = code.replace(
  /    if \(user && !currentBusiness && businesses\.length === 0\) \{\n      return \([\s\S]*?\);\n    \}/,
  \`    if (user && !fetchComplete) {
      return (
        <div className="min-h-screen bg-[#FCFCFB] text-[#37352F] flex items-center justify-center">
          <div className="flex items-center space-x-3 text-rose-800">
            <span className="w-5 h-5 rounded-full border-2 border-rose-800 border-t-transparent animate-spin" />
            <span className="text-sm font-medium">Loading Dashboard...</span>
          </div>
        </div>
      );
    }

    if (user && fetchComplete && businesses.length === 0 && !isSuperAdmin) {
      return (
        <div className="min-h-screen bg-[#FCFCFB] text-[#37352F] flex flex-col items-center justify-center p-4">
          <div className="max-w-md w-full bg-white border border-[#EDEDEB] rounded-3xl p-8 shadow-2xl text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-gray-200">
              <LogOut className="w-8 h-8 text-gray-400" />
            </div>
            <h1 className="text-2xl font-bold text-[#37352F] mb-4">No Salon Found</h1>
            <p className="text-gray-500 text-sm mb-8 leading-relaxed">
              We couldn't find a salon linked to this account.
            </p>
            <div className="flex flex-col space-y-3">
              <button
                onClick={() => setIsOnboardingOpen(true)}
                className="w-full bg-[#37352F] hover:bg-black text-white py-3 rounded-xl font-medium transition-colors shadow-xs"
              >
                Register a New Salon
              </button>
              <button
                onClick={handleLogout}
                className="w-full bg-white border border-[#EDEDEB] hover:bg-gray-50 text-gray-700 py-3 rounded-xl font-medium transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      );
    }\`
);

fs.writeFileSync('src/App.tsx', code);
console.log('App.tsx updated');
