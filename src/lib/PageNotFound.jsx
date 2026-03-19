import { useLocation } from 'react-router-dom';

export default function PageNotFound() {
  const location = useLocation();
  const pageName = location.pathname.substring(1);
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-md w-full text-center space-y-6">
        <h1 className="text-7xl font-light text-muted-foreground">404</h1>
        <div className="h-0.5 w-16 bg-border mx-auto" />
        <h2 className="text-2xl font-medium text-foreground">Página não encontrada</h2>
        <p className="text-muted-foreground">A página <span className="font-medium text-foreground">"{pageName}"</span> não existe.</p>
        <button
          onClick={() => window.location.href = '/'}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-foreground bg-secondary border border-border rounded-lg hover:bg-secondary/80 transition-colors"
        >
          Voltar ao início
        </button>
      </div>
    </div>
  );
}
