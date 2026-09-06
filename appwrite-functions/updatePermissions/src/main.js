import { Client, Databases, Users, Query, Permission, Role } from 'node-appwrite';

export default async ({ req, res, log, error }) => {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  const databases = new Databases(client);
  const users = new Users(client);

  try {
    if (!req.body) throw new Error("Payload vazio.");
    const payload = JSON.parse(req.body);
    const { emailDoConvidado, idDoDocumentoDoOrcamento, permissaoEscolhida } = payload;

    const databaseId = process.env.DATABASE_ID;
    const orcamentoCollectionId = process.env.ORCAMENTO_COLLECTION_ID;
    const notificacaoCollectionId = process.env.NOTIFICACAO_COLLECTION_ID;

    // 1. Localiza o usuário convidado pelo e-mail
    const usersList = await users.list([Query.equal('email', emailDoConvidado)]);
    if (usersList.total === 0) return res.json({ success: false, error: "Usuário não encontrado no sistema." });
    const convidado = usersList.users[0];

    // 2. Puxa os dados do orçamento original
    const orcamento = await databases.getDocument(databaseId, orcamentoCollectionId, idDoDocumentoDoOrcamento);
    const orcamentoData = orcamento.data ? (typeof orcamento.data === 'string' ? JSON.parse(orcamento.data) : orcamento.data) : {};
    
    // 3. Atualiza as permissões no JSON do documento
    orcamentoData.member_permissions = orcamentoData.member_permissions || {};
    orcamentoData.member_permissions[emailDoConvidado.toLowerCase()] = permissaoEscolhida;

    // 4. Salva a alteração no banco de dados com autoridade de servidor
    await databases.updateDocument(
      databaseId,
      orcamentoCollectionId,
      idDoDocumentoDoOrcamento,
      { data: JSON.stringify(orcamentoData) }
    );

    // 5. Cria a notificação para forçar o aplicativo do convidado a piscar e atualizar
    await databases.createDocument(
      databaseId,
      notificacaoCollectionId,
      'unique()',
      {
        userId: convidado.$id,
        budgetId: idDoDocumentoDoOrcamento,
        mensagem: `Sua permissão foi alterada para: ${permissaoEscolhida}`,
        tipo: 'ATUALIZACAO_PERMISSAO'
      },
      [
        Permission.read(Role.user(convidado.$id)),
        Permission.delete(Role.user(convidado.$id))
      ]
    );

    log(`Permissão atualizada com sucesso para o e-mail: ${emailDoConvidado}`);
    return res.json({ success: true, message: "Permissão salva com sucesso!" });

  } catch (err) {
    error(err.message);
    return res.json({ success: false, error: err.message }, 500);
  }
};
