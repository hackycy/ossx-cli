import { loadOssConfig } from './config'
import { uploadOSS } from './upload'

export async function bootstrap(): Promise<void> {
  const cfg = await loadOssConfig()
  await uploadOSS(cfg)
}

bootstrap()
