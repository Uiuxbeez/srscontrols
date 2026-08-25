import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { Layout } from '@/components/layout';
import { LightningText } from '@/components/ui/lightning-text';
import { LoginCard } from '@/pages/login';
import { useAuthMe } from '@/lib/auth-api';

import Dashboard from '@/pages/dashboard';
import ClientsList from '@/pages/clients/list';
import ClientForm from '@/pages/clients/form';
import SuppliersList from '@/pages/suppliers/list';
import SupplierForm from '@/pages/suppliers/form';
import InvoicesList from '@/pages/invoices/list';
import InvoiceForm from '@/pages/invoices/form';
import InvoiceDetail from '@/pages/invoices/detail';
import ProformaInvoicesList from '@/pages/proforma-invoices/list';
import ProformaInvoiceForm from '@/pages/proforma-invoices/form';
import ProformaInvoiceDetail from '@/pages/proforma-invoices/detail';
import PurchaseOrdersList from '@/pages/purchase-orders/list';
import PurchaseOrderForm from '@/pages/purchase-orders/form';
import PurchaseOrderDetail from '@/pages/purchase-orders/detail';
import PurchaseItemMasterList from '@/pages/purchase-item-master/list';
import PurchaseItemMasterForm from '@/pages/purchase-item-master/form';
import QuotationsList from '@/pages/quotations/list';
import QuotationForm from '@/pages/quotations/form';
import QuotationDetail from '@/pages/quotations/detail';
import PanelsList from '@/pages/panels/list';
import PanelForm from '@/pages/panels/form';
import PanelsBulkUpload from '@/pages/panels/bulk-upload';
import TechSpecItemsList from '@/pages/tech-spec-items/list';
import TechSpecItemForm from '@/pages/tech-spec-items/form';
import TechSpecBulkUpload from '@/pages/tech-spec-items/bulk-upload';
import ItemMasterList from '@/pages/item-master/list';
import ItemMasterImport from '@/pages/item-master/import';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        
        {/* Clients */}
        <Route path="/clients" component={ClientsList} />
        <Route path="/clients/new" component={ClientForm} />
        <Route path="/clients/:id/edit" component={ClientForm} />

        {/* Suppliers */}
        <Route path="/suppliers" component={SuppliersList} />
        <Route path="/suppliers/new" component={SupplierForm} />
        <Route path="/suppliers/:id/edit" component={SupplierForm} />

        {/* Invoices */}
        <Route path="/invoices">{() => <InvoicesList />}</Route>
        <Route path="/invoices/new">{() => <InvoiceForm />}</Route>
        <Route path="/invoices/:id" component={InvoiceDetail} />
        <Route path="/invoices/:id/edit">{() => <InvoiceForm />}</Route>

        {/* Proforma Invoices */}
        <Route path="/proforma-invoices" component={ProformaInvoicesList} />
        <Route path="/proforma-invoices/new" component={ProformaInvoiceForm} />
        <Route path="/proforma-invoices/:id" component={ProformaInvoiceDetail} />
        <Route path="/proforma-invoices/:id/edit" component={ProformaInvoiceForm} />

        {/* Purchase Orders */}
        <Route path="/purchase-orders" component={PurchaseOrdersList} />
        <Route path="/purchase-orders/new" component={PurchaseOrderForm} />
        <Route path="/purchase-orders/:id" component={PurchaseOrderDetail} />
        <Route path="/purchase-orders/:id/edit" component={PurchaseOrderForm} />

        {/* Purchase Item Master */}
        <Route path="/purchase-item-master" component={PurchaseItemMasterList} />
        <Route path="/purchase-item-master/new" component={PurchaseItemMasterForm} />
        <Route path="/purchase-item-master/:id/edit" component={PurchaseItemMasterForm} />

        {/* Quotations */}
        <Route path="/quotations" component={QuotationsList} />
        <Route path="/quotations/new" component={QuotationForm} />
        <Route path="/quotations/:id/edit" component={QuotationForm} />
        <Route path="/quotations/:id" component={QuotationDetail} />

        {/* Panel Master */}
        <Route path="/panels" component={PanelsList} />
        <Route path="/panels/new" component={PanelForm} />
        <Route path="/panels/bulk-upload" component={PanelsBulkUpload} />
        <Route path="/panels/:id/edit" component={PanelForm} />

        {/* Tech Spec Master */}
        <Route path="/tech-spec-items" component={TechSpecItemsList} />
        <Route path="/tech-spec-items/new" component={TechSpecItemForm} />
        <Route path="/tech-spec-items/bulk-upload" component={TechSpecBulkUpload} />
        <Route path="/tech-spec-items/:id/edit" component={TechSpecItemForm} />

        {/* Item Master */}
        <Route path="/item-master" component={ItemMasterList} />
        <Route path="/item-master/import" component={ItemMasterImport} />

        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function isPdfRenderMode(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('pdfRender') === '1' || params.get('pdf') === '1';
}

function AuthGate() {
  // The headless Puppeteer PDF export hits this same app with ?pdfRender=1 — skip the
  // decorative intro delay there (the auth check itself still runs as normal).
  const [introDone, setIntroDone] = useState(isPdfRenderMode());
  const { data: user, isLoading } = useAuthMe();

  useEffect(() => {
    if (introDone) return;
    const timer = setTimeout(() => setIntroDone(true), 2600);
    return () => clearTimeout(timer);
  }, [introDone]);

  const authenticated = !isLoading && !!user;

  // Once the intro has played and we know the user is signed in, hand off to the app.
  if (introDone && authenticated) {
    return (
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <Router />
      </WouterRouter>
    );
  }

  // Otherwise the lightning animation stays mounted continuously — the login card is
  // just overlaid lower on the screen once the intro finishes, so it never disappears
  // while typing and never sits on top of the animated text.
  return (
    <div className="relative min-h-screen bg-black overflow-hidden">
      <LightningText text="SRS CONTROLS" className="absolute inset-0" yFraction={0.32} />
      {introDone && !isLoading && !user && (
        <div className="absolute inset-0 flex items-end justify-center px-4 pb-50">
          <LoginCard />
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthGate />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
