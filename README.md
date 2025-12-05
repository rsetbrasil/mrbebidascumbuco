# Sistema PDV MR Bebidas

Sistema completo de Ponto de Venda (PDV) moderno desenvolvido com React.js, Firebase e design otimizado para touchscreen.

## 🚀 Tecnologias

- **Frontend**: React 18 + Vite
- **Backend**: Firebase Firestore + Cloud Functions
- **Impressão**: jsPDF (PDF)
- **UI/UX**: CSS moderno com dark mode e glassmorphism
- **Ícones**: Lucide React
- **Gráficos**: Recharts
- **Roteamento**: React Router v6

## ✨ Funcionalidades

- ✅ **Vendas Diretas** - Interface PDV completa com busca de produtos e carrinho
- ✅ **Pedidos/Pré-Vendas** - Criação e conversão de pedidos em vendas
- ✅ **Caixa** - Abertura/fechamento e movimentações de caixa
- ✅ **Financeiro** - Relatórios e gráficos de vendas
- ✅ **Produtos** - Gerenciamento completo de produtos
- ✅ **Clientes** - Cadastro e gerenciamento de clientes
- ✅ **Impressão** - Cupom não fiscal em PDF com cabeçalho editável
- ✅ **Design Responsivo** - Otimizado para tablets e touchscreen

## 📋 Pré-requisitos

- Node.js 18+ (recomendado Node.js 20+)
- npm ou yarn
- Conta no Firebase (plano gratuito funciona)

## 🔧 Configuração

### 1. Instalar Dependências

```bash
npm install
```

### 2. Configurar Firebase

1. Acesse [Firebase Console](https://console.firebase.google.com/)
2. Crie um novo projeto
3. Ative o Firestore Database
4. Nas configurações do projeto, copie as credenciais do Firebase

### 3. Configurar Variáveis de Ambiente

Copie o arquivo `.env.example` para `.env`:

```bash
copy .env.example .env
```

Edite o arquivo `.env` e adicione suas credenciais do Firebase:

```env
VITE_FIREBASE_API_KEY=sua_api_key
VITE_FIREBASE_AUTH_DOMAIN=seu_projeto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=seu_projeto_id
VITE_FIREBASE_STORAGE_BUCKET=seu_projeto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=seu_sender_id
VITE_FIREBASE_APP_ID=seu_app_id
```

## 🚀 Executar o Projeto

### Modo Desenvolvimento

```bash
npm run dev
```

O aplicativo estará disponível em `http://localhost:3000`

### Build para Produção

```bash
npm run build
```

## 📱 Uso do Sistema

### 1. Abrir o Caixa
Antes de realizar vendas, é necessário abrir o caixa em **Caixa** > **Abrir Caixa**

### 2. Realizar uma Venda
- Acesse **Vendas** no menu
- Busque produtos por nome ou código de barras
- Adicione ao carrinho e finalize

### 3. Configurar Cupom
Acesse **Configurações** para editar cabeçalho e rodapé do cupom

## 📄 Licença

Projeto de uso livre para fins educacionais e comerciais.
