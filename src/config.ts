const config = {
  azureOpenAIKey: process.env.SECRET_AZURE_OPENAI_API_KEY,
  azureOpenAIEndpoint: process.env.AZURE_OPENAI_ENDPOINT,
  azureOpenAIDeploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
  azureStorageConnectionString: process.env.AZURE_STORAGE_CONNECTION_STRING,
  azureSearchApiKey: process.env.SECRET_AZURE_SEARCH_API_KEY,
  azureSearchEndpoint: `https://${process.env.AZURE_SEARCH_SERVICE_NAME}.search.windows.net`,
  azureSearchServiceName: process.env.AZURE_SEARCH_SERVICE_NAME,
  azureSearchIndexName: process.env.AZURE_SEARCH_INDEX_NAME
};

export default config;
