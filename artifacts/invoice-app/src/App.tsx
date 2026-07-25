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
