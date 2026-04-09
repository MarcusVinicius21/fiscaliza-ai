export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Resumo Operacional</h1>
      
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Placeholder Cards */}
        <div className="p-6 bg-white rounded-lg shadow-sm border">
          <h3 className="text-gray-500 text-sm font-medium">Total de Cidades</h3>
          <p className="text-3xl font-bold text-gray-800 mt-2">0</p>
        </div>
        <div className="p-6 bg-white rounded-lg shadow-sm border">
          <h3 className="text-gray-500 text-sm font-medium">Alertas Pendentes</h3>
          <p className="text-3xl font-bold text-red-600 mt-2">0</p>
        </div>
        <div className="p-6 bg-white rounded-lg shadow-sm border">
          <h3 className="text-gray-500 text-sm font-medium">CSVs Processados</h3>
          <p className="text-3xl font-bold text-blue-600 mt-2">0</p>
        </div>
      </div>

      <div className="p-8 mt-6 bg-white border rounded-lg shadow-sm flex flex-col items-center justify-center text-gray-500">
        <p>Bem-vindo à Etapa 1 do Fiscaliza.AI.</p>
        <p className="text-sm">A estrutura de banco e as tabelas visuais entrarão nas próximas fases.</p>
      </div>
    </div>
  );
}