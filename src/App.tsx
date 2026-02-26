import { useState, useEffect } from 'react';
import { Loader2, FolderOpen, Search, Filter, Image as ImageIcon } from 'lucide-react';

interface Product {
  prod_num: string;
  name: string;
  type: string;
  h: string;
  w: string;
  b: string;
  d: string;
  base: string;
  dimensions: string;
  photo_filename: string;
  source_page: string;
  vendor: string;
  price: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'batch' | 'catalogue'>('batch');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');

  useEffect(() => {
    if (activeTab === 'catalogue') {
      fetchProducts();
    }
  }, [activeTab]);

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      setProducts(data);
    } catch (err) {
      console.error('Failed to fetch products', err);
    }
  };

  const startBatchProcessing = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/process', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to start processing');
      }
      setMessage(data.message);
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const types = ['all', ...Array.from(new Set(products.map(p => p.type))).filter(Boolean)];

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.prod_num.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === 'all' || p.type === selectedType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans">
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-semibold tracking-tight">Catalogue Manager</h1>
            <nav className="flex space-x-4">
              <button
                onClick={() => setActiveTab('batch')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'batch' 
                    ? 'bg-neutral-900 text-white' 
                    : 'text-neutral-600 hover:bg-neutral-100'
                }`}
              >
                Batch Processor
              </button>
              <button
                onClick={() => setActiveTab('catalogue')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'catalogue' 
                    ? 'bg-neutral-900 text-white' 
                    : 'text-neutral-600 hover:bg-neutral-100'
                }`}
              >
                Catalogue Browser
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'batch' ? (
          <div className="max-w-2xl mx-auto space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-semibold tracking-tight">Process Directory</h2>
              <p className="text-neutral-500">
                Ensure you have a <code className="bg-neutral-200 px-1 rounded">pots</code> directory in the root of your project containing subdirectories of images.
              </p>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-sm border border-neutral-200 text-center space-y-6">
              <div className="bg-neutral-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto">
                <FolderOpen className="w-10 h-10 text-neutral-400" />
              </div>
              
              <div>
                <h3 className="text-lg font-medium">Ready to process</h3>
                <p className="text-sm text-neutral-500 mt-1">
                  This will read all images, extract products, crop them, save to <code className="bg-neutral-100 px-1 rounded">extracted/</code>, and generate <code className="bg-neutral-100 px-1 rounded">products.csv</code>.
                </p>
              </div>

              <button
                onClick={startBatchProcessing}
                disabled={loading}
                className="w-full bg-neutral-900 text-white px-6 py-3 rounded-xl font-medium hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                {loading ? 'Starting Process...' : 'Start Batch Processing'}
              </button>

              {message && (
                <div className={`p-4 rounded-xl text-sm border flex items-start gap-3 text-left ${
                  message.includes('error') || message.includes('Failed') || message.includes('does not exist')
                    ? 'bg-red-50 text-red-600 border-red-100'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                }`}>
                  <div className="mt-0.5">{message.includes('error') || message.includes('Failed') || message.includes('does not exist') ? '⚠️' : '✅'}</div>
                  <div>{message}</div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
              <h2 className="text-2xl font-semibold tracking-tight">Products ({filteredProducts.length})</h2>
              
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 pr-4 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 w-full sm:w-64"
                  />
                </div>
                
                <div className="relative">
                  <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                    className="pl-9 pr-8 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 appearance-none bg-white w-full sm:w-40"
                  >
                    {types.map(type => (
                      <option key={type} value={type}>
                        {type === 'all' ? 'All Types' : type}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {products.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-3xl border border-neutral-200 border-dashed">
                <ImageIcon className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-neutral-900">No products found</h3>
                <p className="text-neutral-500 mt-1">Run the batch processor to extract products from your images.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredProducts.map((product) => (
                  <div key={product.prod_num} className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm hover:shadow-md transition-all group flex flex-col">
                    <div className="aspect-square bg-neutral-50/50 p-6 flex items-center justify-center border-b border-neutral-100 relative">
                      <img 
                        src={`/extracted/${product.photo_filename}`} 
                        alt={product.name}
                        className="max-w-full max-h-full object-contain drop-shadow-sm group-hover:scale-105 transition-transform duration-500"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNkNGRkZTUiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cmVjdCB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHg9IjMiIHk9IjMiIHJ4PSIyIiByeT0iMiIvPjxjaXJjbGUgY3g9IjkiIGN5PSI5IiByPSIyIi8+PHBhdGggZD0ibTIxIDE1LTMuMDgtMy4wOGExLjIgMS4yIDAgMCAwLTEuNzEgMGwtOS42IDkuNiIvPjwvc3ZnPg==';
                        }}
                      />
                      <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-md text-xs font-mono font-medium text-neutral-600 shadow-sm border border-neutral-100">
                        #{product.prod_num}
                      </div>
                    </div>
                    <div className="p-5 flex-1 flex flex-col justify-between bg-white">
                      <div className="space-y-3">
                        <div>
                          <h3 className="font-medium text-neutral-900 leading-tight">{product.name}</h3>
                          <p className="text-xs text-neutral-400 mt-1 uppercase tracking-wider">{product.type} • {product.vendor}</p>
                        </div>
                        
                        <div className="space-y-1.5">
                          <p className="text-sm text-neutral-600 font-mono bg-neutral-50 px-2 py-1 rounded border border-neutral-100 inline-block w-full truncate" title={product.dimensions}>
                            {product.dimensions}
                          </p>
                          
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            {product.h && <div className="text-neutral-500"><span className="text-neutral-400">H:</span> {product.h}</div>}
                            {product.w && <div className="text-neutral-500"><span className="text-neutral-400">W:</span> {product.w}</div>}
                            {product.d && <div className="text-neutral-500"><span className="text-neutral-400">D:</span> {product.d}</div>}
                            {product.b && <div className="text-neutral-500"><span className="text-neutral-400">B:</span> {product.b}</div>}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
