from pathlib import Path
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR

ROOT = Path(__file__).resolve().parent
src = ROOT / 'trabalho-source.pptx'
dst = ROOT / 'trabalho-corrigido.pptx'
prs = Presentation()
prs.slide_width = Inches(13.333333)
prs.slide_height = Inches(7.5)
for _ in range(18): prs.slides.add_slide(prs.slide_layouts[6])

PURPLE = '#A62798'
INK = '#142B46'
MUTED = '#5B6470'
LILAC = '#F4E9F5'
GREEN = '#DDF2E5'
GREEN_D = '#1E6A43'
RED = '#F9E3E3'
RED_D = '#A83939'
BLUE = '#E6EFF7'
BLUE_D = '#225A7A'
WHITE = '#FFFFFF'
EDGE = '#D7DCE2'

def C(h): return RGBColor.from_string(h.lstrip('#'))
def I(v): return Inches(v/96)
def pt(v): return Pt(v*.75)

def rect(s,x,y,w,h,fill=WHITE,line=None,radius=False):
    sh=s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE if radius else MSO_SHAPE.RECTANGLE,I(x),I(y),I(w),I(h))
    sh.fill.solid(); sh.fill.fore_color.rgb=C(fill)
    if line:
        sh.line.color.rgb=C(line); sh.line.width=pt(1.2)
    else: sh.line.fill.background()
    if radius:
        try: sh.adjustments[0]=0.13
        except Exception: pass
    return sh

def txt(s,t,x,y,w,h,size=25,color=INK,bold=False,align='left',valign='top'):
    sh=s.shapes.add_textbox(I(x),I(y),I(w),I(h))
    tf=sh.text_frame; tf.clear(); tf.word_wrap=True
    tf.margin_left=tf.margin_right=tf.margin_top=tf.margin_bottom=0
    tf.vertical_anchor=MSO_ANCHOR.MIDDLE if valign=='middle' else MSO_ANCHOR.TOP
    for j,line in enumerate(t.split('\n')):
        p=tf.paragraphs[0] if j==0 else tf.add_paragraph()
        p.text=line
        p.alignment={'left':PP_ALIGN.LEFT,'center':PP_ALIGN.CENTER,'right':PP_ALIGN.RIGHT}[align]
        p.space_after=Pt(0)
        p.font.name='Aptos'; p.font.size=pt(size); p.font.bold=bold; p.font.color.rgb=C(color)
    return sh

def base(n,title,subtitle=None):
    s=prs.slides[n-1]
    for sh in list(s.shapes):
        s.shapes._spTree.remove(sh._element)
    rect(s,0,0,1280,40,PURPLE)
    txt(s,title,68,75,1150,105,47,'#000000',True)
    if subtitle: txt(s,subtitle,72,173,1130,43,24,MUTED)
    txt(s,'Grupo 4 · Gerenciamento e otimização',68,682,650,25,18,PURPLE,True)
    txt(s,str(n),1170,682,43,25,17,MUTED,align='right')
    return s

def card(s,title,body,x,y,w,h,fill=LILAC,accent=PURPLE,ts=27,bs=24):
    rect(s,x,y,w,h,fill,EDGE,True)
    rect(s,x,y,8,h,accent)
    txt(s,title,x+24,y+19,w-45,45,ts,accent,True)
    txt(s,body,x+24,y+77,w-46,h-87,bs,INK)

def label(s,t,x,y,w,h,fill=BLUE,color=INK,size=25):
    rect(s,x,y,w,h,fill,EDGE,True)
    txt(s,t,x+6,y+3,w-12,h-6,size,color,True,'center','middle')

FREE={2,4,5,7,10,11,13,14}
def disk(s,x,y,cell=110,gap=16,showbit=False,allocated2=False):
    for i in range(16):
        col=i%8; row=i//8; xx=x+col*(cell+gap); yy=y+row*105
        free=(i in FREE and not(allocated2 and i==2))
        rect(s,xx,yy,cell,74,GREEN if free else RED, GREEN_D if free else RED_D,True)
        txt(s,str(i),xx,yy+7,cell,34,28,INK,True,'center')
        txt(s,('0 · livre' if free else '1 · ocupado') if showbit else ('livre' if free else 'ocupado'),xx+2,yy+42,cell-4,24,16,GREEN_D if free else RED_D,False,'center')

# 1–2 — Abertura e créditos do grupo.
s=prs.slides[0]
rect(s,0,0,1280,17,BLUE_D)
txt(s,'Sistemas de Arquivos',145,254,990,93,77,INK,True,'center')
txt(s,'Sistemas Operacionais – 2026/2 · Aula 15\nTrabalho em grupo',184,389,912,91,31,'#434343',False,'center')
rect(s,0,704,1280,16,BLUE_D)
s=base(2,'Grupo 4 · Gerenciamento e otimização')
txt(s,'Arthur Teixeira · Ana Laressa · João Pedro\nMagno · Regis · Victor da Mata',112,260,1056,140,35,INK,True,'center')
card(s,'Foco da apresentação','Gerência do espaço livre e uso de cache para melhorar o desempenho e preservar a consistência dos arquivos.',105,458,1070,137,LILAC,PURPLE,27,24)

# 3 — Um disco único em todos os exemplos.
s=base(3,'O mesmo disco em todos os exemplos','16 blocos, numerados de 0 a 15')
disk(s,100,255,118,19)
label(s,'8 livres',107,506,236,68,GREEN,GREEN_D,30)
label(s,'8 ocupados',363,506,236,68,RED,RED_D,30)
txt(s,'O bitmap e a lista dos próximos slides representam exatamente este disco.',633,502,540,91,26,INK)

# 4 — Bitmap.
s=base(4,'Mapa de bits (bitmap)','1 = ocupado · 0 = livre · posição do bit = número do bloco')
disk(s,100,239,118,19,True)
txt(s,'Bitmap do exemplo: 1 1 0 1 0 0 1 0  1 1 0 0 1 0 0 1',100,485,1080,53,27,INK,True,'center')
txt(s,'Para alocar o bloco 2, o SO muda seu bit de 0 para 1.',115,563,1050,43,25,PURPLE,True,'center')

# 5 — Tamanho e custo.
s=base(5,'Quanto espaço ocupa o bitmap?','Exemplo: disco de 1 TiB com blocos de 4 KiB')
label(s,'1 TiB ÷ 4 KiB',69,250,323,95,BLUE,BLUE_D,33)
txt(s,'→',402,273,62,54,43,PURPLE,True,'center')
label(s,'256 Mi blocos',470,250,323,95,LILAC,PURPLE,32)
txt(s,'→',801,273,62,54,43,PURPLE,True,'center')
label(s,'256 Mi bits = 32 MiB',868,250,340,95,GREEN,GREEN_D,28)
card(s,'Custo em memória','Para consulta rápida, o bitmap fica em RAM, total ou parcialmente. Neste exemplo, 32 MiB.',82,411,540,187,BLUE,BLUE_D,27,23)
card(s,'Disco quase cheio','A busca por um bit 0 pode varrer muitas posições antes de achar um bloco livre.',656,411,540,187,RED,RED_D,27,23)

# 6 — Lista encadeada, figura original.
s=base(6,'Lista encadeada de blocos livres','Cada nó aponta para o próximo bloco livre; o primeiro ponteiro é a cabeça.')
txt(s,'cabeça',77,284,109,35,22,MUTED,True)
nodes=[2,4,5,7,10,11,13,14]
for j,b in enumerate(nodes):
    x=116+j*128
    label(s,str(b),x,332,81,77,GREEN,GREEN_D,33)
    if j<7: txt(s,'→',x+86,343,40,50,36,PURPLE,True,'center')
txt(s,'→ nulo',1130,347,128,50,27,MUTED,True)
txt(s,'Blocos ocupados: 0, 1, 3, 6, 8, 9, 12 e 15.',107,490,1050,43,25,INK)
txt(s,'Figura: elaboração própria. Mesmos 16 blocos do bitmap.',107,542,1050,37,21,MUTED)

# 7 — Lista após alocação.
s=base(7,'Alocar pela lista livre','O SO retira o primeiro bloco livre e atualiza a cabeça da lista.')
card(s,'Antes','cabeça → 2 → 4 → 5 → 7 → 10 → 11 → 13 → 14 → nulo',83,245,1110,120,BLUE,BLUE_D,29,25)
card(s,'Depois de alocar o bloco 2','cabeça → 4 → 5 → 7 → 10 → 11 → 13 → 14 → nulo',83,393,1110,120,GREEN,GREEN_D,29,25)
txt(s,'No bitmap do mesmo disco: bit 2 muda de 0 para 1.',109,546,1050,43,26,PURPLE,True)

# 8 — Cache do SO, sem imagem da controladora.
s=base(8,'Cache de disco: o caminho da leitura','O SO guarda na RAM cópias de dados de arquivos acessados recentemente.')
label(s,'Programa',90,269,216,96,BLUE,BLUE_D,29)
txt(s,'→',326,288,66,55,43,PURPLE,True,'center')
label(s,'Cache do SO\nna RAM',410,269,300,96,LILAC,PURPLE,29)
txt(s,'↔',731,288,66,55,43,PURPLE,True,'center')
label(s,'HDD ou SSD',815,269,347,96,GREEN,GREEN_D,29)
card(s,'Por que acelera?','Se os dados já estão na RAM, a próxima leitura dispensa acesso ao dispositivo de armazenamento.',89,418,1077,161,BLUE,BLUE_D,29,26)

# 9 — Diferença com cache da CPU.
s=base(9,'Duas caches, funções diferentes','Aqui, “cache de disco” é a cache do sistema operacional, não a da controladora.')
card(s,'Cache da CPU · L1/L2/L3','Fica no processador. Guarda dados e instruções para reduzir acessos à RAM.',80,253,540,187,LILAC,PURPLE,28,25)
card(s,'Cache do SO · page cache','Fica na RAM. Guarda páginas de arquivos para reduzir acessos ao HDD ou SSD.',660,253,540,187,BLUE,BLUE_D,28,25)
label(s,'CPU',160,506,165,74,LILAC,PURPLE,27)
txt(s,'↔',337,519,65,45,35,PURPLE,True,'center')
label(s,'RAM',412,506,165,74,BLUE,BLUE_D,27)
txt(s,'↔',588,519,65,45,35,PURPLE,True,'center')
label(s,'HDD / SSD',669,506,283,74,GREEN,GREEN_D,27)
txt(s,'Cache da controladora: memória no próprio dispositivo.',968,493,235,105,20,MUTED)

# 10 — Comparação direta.
s=base(10,'Cache de disco × cache do processador')
card(s,'Cache do SO · na RAM','Guarda dados de arquivos. Gerenciada pelo SO. Evita leituras repetidas no HDD ou SSD.',73,242,550,236,GREEN,GREEN_D,28,25)
card(s,'Cache da CPU · L1/L2/L3','Guarda dados e instruções em uso. Gerenciada pelo hardware. Reduz acessos à RAM.',657,242,550,236,LILAC,PURPLE,28,25)
txt(s,'A cache do SO opera em páginas de arquivos; a cache da CPU opera em linhas de memória.',100,541,1080,78,27,INK,True,'center')

# 11 — Hit/miss.
s=base(11,'Leitura: acerto (hit) e falta (miss)','Hit: o dado já está na RAM. Miss: o SO precisa buscá-lo no disco.')
label(s,'Programa pede bloco X',88,282,345,104,BLUE,BLUE_D,28)
txt(s,'→',449,311,65,50,39,PURPLE,True,'center')
label(s,'X está na cache?',530,282,300,104,LILAC,PURPLE,28)
txt(s,'↗',846,244,67,54,38,PURPLE,True,'center')
label(s,'HIT: responde da RAM',911,220,296,105,GREEN,GREEN_D,25)
txt(s,'↘',846,392,67,54,38,PURPLE,True,'center')
label(s,'MISS: lê disco, põe na RAM e responde',911,364,296,145,RED,RED_D,23)
txt(s,'O hit costuma ser mais rápido porque evita o acesso ao dispositivo.',101,549,1070,68,27,INK,True,'center')

# 12 — Definição de sujo antes do LRU.
s=base(12,'Bloco “sujo” e políticas de gravação','Bloco sujo: foi alterado na RAM, mas ainda não foi persistido no disco.')
card(s,'Write-through','Cada escrita atualiza a cache e o disco antes de confirmar. Mais lento; menor janela de perda.',75,258,541,218,BLUE,BLUE_D,29,25)
card(s,'Write-back','Confirma a escrita na cache. O bloco fica sujo e é gravado no disco depois. Mais rápido; há janela de perda.',657,258,541,218,LILAC,PURPLE,29,25)
txt(s,'“Gravou no arquivo” pode significar que a escrita ainda está apenas na RAM.',96,535,1080,55,26,RED_D,True,'center')

# 13 — Tempo e ordem.
s=base(13,'Quando e em que ordem gravar?','Atualizar dados em cache e atualizar o disco são eventos diferentes.')
card(s,'Gravação periódica','Exemplo didático: um temporizador tenta descarregar blocos sujos a cada 30 s. O intervalo real depende do SO e da configuração.',78,249,544,231,BLUE,BLUE_D,28,24)
card(s,'Metadados primeiro: risco','Se o ponteiro/bitmap for persistido antes dos dados, uma pane pode deixar o sistema de arquivos inconsistente ou expor dados antigos.',659,249,544,231,RED,RED_D,28,24)
txt(s,'No ext4 em modo ordered, os dados são gravados antes de confirmar os metadados relacionados.',100,533,1080,67,25,GREEN_D,True,'center')

# 14 — LRU e bloco sujo.
s=base(14,'Substituição de blocos: LRU','LRU = descartar da cache o bloco usado há mais tempo.')
for x,t,fill,col in [(82,'A\nrecente',GREEN,GREEN_D),(342,'C\nintermediário',BLUE,BLUE_D),(602,'B\nmenos recente',LILAC,PURPLE)]:
    label(s,t,x,264,204,121,fill,col,27)
txt(s,'Novo bloco D precisa entrar na cache.',854,270,328,87,28,INK,True)
txt(s,'→',872,370,80,51,42,PURPLE,True,'center')
label(s,'D ocupa o lugar de B',965,367,232,98,GREEN,GREEN_D,25)
card(s,'Se B estiver sujo','Grave B no disco antes de removê-lo; se estiver limpo, basta descartá-lo.',94,505,1090,128,RED,RED_D,27,24)

# 15 — Pane e proteção.
s=base(15,'Se faltar energia no meio da gravação','A ordem e o momento da escrita determinam o que pode ser perdido.')
card(s,'Dados só na RAM','Uma pane pode perder as últimas alterações ainda não persistidas (write-back ou descarga periódica).',78,246,544,194,RED,RED_D,28,24)
card(s,'Metadados fora de sincronia','Ponteiros e bitmap podem discordar dos dados já gravados; o sistema de arquivos pode exigir recuperação.',659,246,544,194,RED,RED_D,28,24)
card(s,'Como reduzir o risco','Ordenação das escritas, journaling e sincronização explícita (fsync) reduzem a janela de perda e ajudam na consistência.',79,469,1124,153,GREEN,GREEN_D,28,24)

# 16 — Exemplos reais, sem espaços vazios.
s=base(16,'Como os sistemas reais fazem isso','Os mecanismos concretos variam; o disco de 16 blocos é apenas um modelo didático.')
card(s,'Linux · ext4','Mapas de bits por grupos de blocos; page cache na RAM; modo ordered grava dados antes do commit de metadados.',72,250,359,335,BLUE,BLUE_D,27,23)
card(s,'Windows · NTFS','Arquivo especial $Bitmap controla a alocação de clusters. O Windows também usa cache de arquivos na RAM.',461,250,359,335,LILAC,PURPLE,27,23)
card(s,'Windows · FAT32','A tabela FAT encadeia clusters dos arquivos; a estrutura FSInfo pode guardar contagem estimada de clusters livres.',850,250,359,335,GREEN,GREEN_D,27,23)

# 17 — Exemplo completo com dados, metadados e cache.
s=base(17,'Exemplo completo: criar, ler e liberar','A mesma sequência junta espaço livre, cache e persistência.')
steps=[('1','Alocar','bloco 2 sai da lista; bit 2: 0 → 1'),('2','Escrever','dados entram na page cache; bloco fica sujo'),('3','Persistir','dados e metadados vão ao disco na ordem segura'),('4','Ler','se ainda está em cache: hit; caso contrário: miss'),('5','Substituir','LRU pode escolher o menos recente; sujo é gravado'),('6','Liberar','ao excluir, bloco 2 volta a ser livre; bit 2: 1 → 0')]
for j,(num,t,b) in enumerate(steps):
    x=71+(j%3)*385; y=236+(j//3)*195
    rect(s,x,y,350,159,[BLUE,LILAC,GREEN][j%3],EDGE,True)
    label(s,num,x+17,y+20,46,46,PURPLE,WHITE,24)
    txt(s,t,x+77,y+19,258,44,29,INK,True)
    txt(s,b,x+21,y+72,315,74,21,INK)

# 18 — Referências e crédito dos diagramas.
s=base(18,'Referências e fontes dos diagramas')
refs=[
 'OLIVEIRA, R. S.; CARISSIMI, A. S.; TOSCANI, S. S. Sistemas operacionais. 4. ed. Bookman, 2010.',
 'SILBERSCHATZ, A. Fundamentos de sistemas operacionais. 9. ed. Pearson, 2015.',
 'UFF. Sistemas operacionais, cap. 8. telecom.uff.br/~marcos//SO/cap8.pdf',
 'Linux Kernel Documentation. Ext4 General Information; Documentation for /proc/sys/vm/. docs.kernel.org',
 'Microsoft Learn. Master File Table (NTFS) e FAT32 File System Specification. learn.microsoft.com',
 'Diagramas dos slides 3–9 e 12–17: elaboração própria, com base nas fontes acima.'
]
for j,r in enumerate(refs):
    y=219+j*68
    rect(s,70,y+5,9,40,PURPLE)
    txt(s,r,97,y,1080,57,20,INK)

prs.save(dst)
print(dst)
