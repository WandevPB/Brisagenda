// Componentes UI utilizados no projeto
const componentesUsados = [
    'button.tsx',
    'input.tsx',
    'label.tsx',
    'card.tsx',
    'select.tsx',
    'calendar.tsx',
    'popover.tsx',
    'badge.tsx',
    'textarea.tsx',
    'dialog.tsx',
    'toast.tsx',
    'toaster.tsx',
    'use-toast.ts',
    'sonner.tsx'
];

// Todos os componentes na pasta ui
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uiPath = path.join(__dirname, 'src', 'components', 'ui');
const files = fs.readdirSync(uiPath);

console.log('🔍 ANALISANDO COMPONENTES UI...');
console.log(`Total de componentes encontrados: ${files.length}`);
console.log(`Componentes utilizados: ${componentesUsados.length}`);

const componentesNaoUsados = files.filter(file => !componentesUsados.includes(file));

console.log('\n📋 COMPONENTES NÃO UTILIZADOS:');
componentesNaoUsados.forEach(comp => console.log(`- ${comp}`));

console.log(`\n🗑️ Total a remover: ${componentesNaoUsados.length}`);

// Remover componentes não utilizados
componentesNaoUsados.forEach(comp => {
    const filePath = path.join(uiPath, comp);
    try {
        fs.unlinkSync(filePath);
        console.log(`✅ Removido: ${comp}`);
    } catch (error) {
        console.log(`❌ Erro ao remover ${comp}: ${error.message}`);
    }
});

console.log('\n✅ LIMPEZA DE COMPONENTES UI CONCLUÍDA!');
