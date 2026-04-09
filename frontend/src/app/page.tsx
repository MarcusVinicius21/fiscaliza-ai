import { redirect } from 'next/navigation';

export default function Home() {
  // Na Etapa 1, a raiz sempre redireciona para o login.
  redirect('/login');
}