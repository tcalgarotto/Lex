import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ApresentacaoPage() {
 return (
 <div className="w-full min-w-0 space-y-6">
 <Card>
 <CardHeader>
 <CardTitle className="text-base">JustOS — Sistema operacional jurídico</CardTitle>
 <p className="text-sm text-muted-foreground">
 Não é “chat com PDF”. É <span className="text-[color:var(--text-primary)]">memória jurídica + fontes verificáveis</span> + geração de peça no seu estilo, com guardrails contra alucinação.
 </p>
 </CardHeader>
 <CardContent className="flex flex-wrap gap-2">
 <Button asChild>
 <Link href="/demo">Entrar no modo demonstração</Link>
 </Button>
 <Button asChild variant="outline">
 <Link href="/dashboard">Ir para o dashboard</Link>
 </Button>
 <Button asChild variant="outline">
 <Link href="/settings/readiness">Checklist de prontidão</Link>
 </Button>
 </CardContent>
 </Card>

 <div className="grid gap-4 md:grid-cols-2">
 <Card>
 <CardHeader>
 <CardTitle className="text-base">Como funciona</CardTitle>
 </CardHeader>
 <CardContent className="space-y-2 text-sm text-muted-foreground">
 <p>
 1) Você envia documentos. O JustOS extrai texto, separa em seções e indexa.
 </p>
 <p>
 2) No chat, o JustOS recupera trechos relevantes com assistência de IA e responde com <span className="text-[color:var(--text-primary)]">fontes usadas</span>.
 </p>
 <p>
 3) Se a base for insuficiente, o JustOS inicia com aviso e evita afirmar prazos/artigos/precedentes.
 </p>
 <p>
 4) Você gera peça com base no processo e edita no editor com autosave e exportação.
 </p>
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle className="text-base">Por que é diferente</CardTitle>
 </CardHeader>
 <CardContent className="space-y-2 text-sm text-muted-foreground">
 <p>
 - <span className="text-[color:var(--text-primary)]">Fontes primeiro</span>: cada resposta mostra o que foi efetivamente usado.
 </p>
 <p>
 - <span className="text-[color:var(--text-primary)]">Confiança jurídica</span>: label + justificativa curta.
 </p>
 <p>
 - <span className="text-[color:var(--text-primary)]">Memória do processo</span>: histórico e estratégia ficam consistentes ao longo do tempo.
 </p>
 <p>
 - <span className="text-[color:var(--text-primary)]">Estilo do advogado</span>: perfil de escrita aplicado automaticamente.
 </p>
 </CardContent>
 </Card>
 </div>

 <Card>
 <CardHeader>
 <CardTitle className="text-base">Fluxo demonstrável</CardTitle>
 </CardHeader>
 <CardContent className="space-y-2 text-sm text-muted-foreground">
 <p>
 “Subi um despacho, perguntei o que fazer, vi as fontes, gerei uma manifestação, editei e exportei.”
 </p>
 <p>
 Use o <Link className="text-violet-300 hover:underline" href="/demo">modo demonstração</Link> para guiar a apresentação.
 </p>
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle className="text-base">Roadmap (alto nível)</CardTitle>
 </CardHeader>
 <CardContent className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
 <p>- melhora contínua de fontes e confiabilidade</p>
 <p>- mais templates de peças e painéis laterais</p>
 <p>- avaliações automáticas (grounding/alucinação)</p>
 <p>- multi-tenant e observabilidade avançada</p>
 </CardContent>
 </Card>
 </div>
 );
}

