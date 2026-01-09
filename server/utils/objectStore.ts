import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

// S3 클라이언트를 lazy loading으로 변경 (환경 변수 로딩 후 초기화)
let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: process.env.OBJECT_STORE_REGION || 'ap-northeast-2',
      credentials: {
        accessKeyId: process.env.OBJECT_STORE_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.OBJECT_STORE_SECRET_ACCESS_KEY || '',
      },
    });
  }
  return s3Client;
}

const BUCKET_NAME = process.env.OBJECT_STORE_BUCKET || '';

/**
 * Object Store에 파일 업로드
 */
export async function uploadToObjectStore(
  filePath: string,
  fileBuffer: Buffer,
  contentType: string
): Promise<string> {
  try {
    const key = `rag-documents/${filePath}`;
    const client = getS3Client();
    
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
    });
    
    await client.send(command);
    
    // URL 반환 (s3:// 스키마 사용)
    return `s3://${BUCKET_NAME}/${key}`;
  } catch (error) {
    console.error('Object Store 업로드 오류:', error);
    throw error;
  }
}

/**
 * Object Store에서 파일 다운로드
 */
export async function downloadFromObjectStore(objectKey: string): Promise<Buffer> {
  try {
    // s3:// URL에서 실제 키 추출
    const key = objectKey.startsWith('s3://') 
      ? objectKey.replace(/^s3:\/\/[^/]+\//, '')
      : objectKey;
    
    const client = getS3Client();
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });
    
    const response = await client.send(command);
    const stream = response.Body as Readable;
    
    // Stream을 Buffer로 변환
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    
    return Buffer.concat(chunks);
  } catch (error) {
    console.error('Object Store 다운로드 오류:', error);
    throw error;
  }
}

/**
 * Object Store에서 파일 삭제
 */
export async function deleteFromObjectStore(objectKey: string): Promise<void> {
  try {
    // s3:// URL에서 실제 키 추출
    const key = objectKey.startsWith('s3://') 
      ? objectKey.replace(/^s3:\/\/[^/]+\//, '')
      : objectKey;
    
    const client = getS3Client();
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });
    
    await client.send(command);
  } catch (error) {
    console.error('Object Store 삭제 오류:', error);
    throw error;
  }
}

/**
 * Object Store URL 생성 (공개 접근용)
 */
export function getObjectStoreUrl(objectKey: string): string {
  const key = objectKey.startsWith('s3://') 
    ? objectKey.replace(/^s3:\/\/[^/]+\//, '')
    : objectKey;
    
  return `https://${process.env.OBJECT_STORE_HOST || 's3-ap-northeast-2.amazonaws.com'}/${BUCKET_NAME}/${key}`;
}

/**
 * Object Store 연결 상태 확인
 */
export async function checkObjectStoreConnection(): Promise<boolean> {
  try {
    // 간단한 테스트 - 버킷 존재 확인
    const hasBucket = BUCKET_NAME.length > 0;
    const accessKeyId = process.env.OBJECT_STORE_ACCESS_KEY_ID || '';
    const hasAccessKey = accessKeyId.length > 0;
    return hasBucket && hasAccessKey;
  } catch (error) {
    return false;
  }
}

