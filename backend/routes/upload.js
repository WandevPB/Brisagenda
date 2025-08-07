const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// Criar diretório uploads se não existir
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configuração do multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // Gerar nome único para o arquivo
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, 'nota-fiscal-' + uniqueSuffix + extension);
  }
});

// Filtro para aceitar apenas PDFs
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Apenas arquivos PDF são permitidos!'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

// Rota para upload de nota fiscal
router.post('/nota-fiscal', (req, res, next) => {
  console.log('🔄 Iniciando upload - Headers:', {
    'content-type': req.headers['content-type'],
    'content-length': req.headers['content-length']
  });
  next();
}, upload.single('arquivo'), (req, res) => {
  try {
    console.log('📤 Upload solicitado:', {
      file: req.file ? req.file.filename : 'Nenhum arquivo',
      mimetype: req.file ? req.file.mimetype : 'N/A',
      size: req.file ? req.file.size : 'N/A'
    });

    if (!req.file) {
      console.log('❌ Erro: Nenhum arquivo foi enviado');
      return res.status(400).json({
        success: false,
        message: 'Nenhum arquivo foi enviado'
      });
    }

    // Retornar o caminho do arquivo
    const filePath = '/uploads/' + req.file.filename;
    
    console.log('✅ Upload realizado com sucesso:', filePath);
    
    res.json({
      success: true,
      message: 'Arquivo enviado com sucesso',
      filePath: filePath
    });
  } catch (error) {
    console.error('❌ Erro no upload:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// Middleware de tratamento de erros do multer
router.use((error, req, res, next) => {
  console.log('🚨 Erro no middleware de upload:', {
    error: error.message,
    code: error.code,
    type: error.constructor.name
  });

  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      console.log('❌ Arquivo muito grande:', error);
      return res.status(400).json({
        success: false,
        message: 'Arquivo muito grande. Tamanho máximo: 5MB'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      console.log('❌ Campo de arquivo inválido:', error);
      return res.status(400).json({
        success: false,
        message: 'Campo de arquivo inválido. Use o campo "arquivo"'
      });
    }
    console.log('❌ Erro do Multer:', error);
    return res.status(400).json({
      success: false,
      message: `Erro no upload: ${error.message}`
    });
  }
  
  if (error.message === 'Apenas arquivos PDF são permitidos!') {
    console.log('❌ Tipo de arquivo inválido:', error);
    return res.status(400).json({
      success: false,
      message: 'Apenas arquivos PDF são permitidos'
    });
  }
  
  console.log('❌ Erro desconhecido no upload:', error);
  res.status(500).json({
    success: false,
    message: 'Erro no upload do arquivo'
  });
});

module.exports = router; 