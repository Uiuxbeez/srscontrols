import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { Layout } from '@/components/layout';

import Dashboard from '@/pages/dashboard';
import ClientsList from '@/pages/clients/list';
import ClientForm from '@/pages/clients/form';
import InvoicesList from '@/pages/invoices/list';
import InvoiceForm from '@/pages/invoices/form';
import InvoiceDetail from '@/pages/invoices/detail';
import QuotationsList from '@/pages/quotations/list';
import QuotationForm from '@/pages/quotations/form';
import QuotationDetail from '@/pages/quotations/detail';
import PanelsList from '@/pages/panels/list';
import PanelForm from '@/pages/panels/form';
import TechSpecItemsList from '@/pages/tech-spec-items/list';
import TechSpecItemForm from '@/pages/tech-spec-items/form';

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
        
        {/* Invoices */}
        <Route path="/invoices" component={InvoicesList} />
        <Route path="/invoices/new" component={InvoiceForm} />
        <Route path="/invoices/:id" component={InvoiceDetail} />
        <Route path="/invoices/:id/edit" component={InvoiceForm} />

        {/* Quotations */}
        <Route path="/quotations" component={QuotationsList} />
        <Route path="/quotations/new" component={QuotationForm} />
        <Route path="/quotations/:id/edit" component={QuotationForm} />
        <Route path="/quotations/:id" component={QuotationDetail} />

        {/* Panel Master */}
        <Route path="/panels" component={PanelsList} />
        <Route path="/panels/new" component={PanelForm} />
        <Route path="/panels/:id/edit" component={PanelForm} />

        {/* Tech Spec Master */}
        <Route path="/tech-spec-items" component={TechSpecItemsList} />
        <Route path="/tech-spec-items/new" component={TechSpecItemForm} />
        <Route path="/tech-spec-items/:id/edit" component={TechSpecItemForm} />

        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
