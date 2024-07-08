import { BadRequestException, Injectable } from '@nestjs/common';
import { DeleteObjectCommand, DeleteObjectsCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, PutObjectCommandOutput, PutObjectRequest, S3, S3Client } from '@aws-sdk/client-s3';
import { ServerAwsS3Config } from '../classes/server-aws-s3-config.class';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { IS3UploadResponse } from '../interfaces/s3-upload-response.interface';
import { resolveUrl } from '../functions/resolve-url.function';

export type TS3Params = {
  Key: string,
  Bucket?: string | null | undefined
};

export type TS3PrefixParams = Omit<TS3Params, 'Key'> & {
  Prefix: string;
};

export type TS3ObjectsParams = Omit<TS3Params, 'Key'> & {
  Objects: { Key: string }[];
};

@Injectable()
export class S3Service {
  constructor(private config: ServerAwsS3Config, private s3: S3Client) { }

  async upload(params: TS3Params & { Body: PutObjectRequest['Body'], ACL?: PutObjectRequest['ACL'], ContentType?: PutObjectRequest['ContentType'] }): Promise<IS3UploadResponse> {
    // todo: sanitize filename here before uploading
    const resolvedParams = this.addDefaultBucket(params);
    const command = new PutObjectCommand(this.addDefaultBucket(resolvedParams));
    const { ETag } = await this.s3.send(command);
    const Location = resolveUrl(this.config.AWS_REGION, params);

    return {
      Location,
      ...resolvedParams,
      ETag,
    };
  }

  async uploadPublic(params: TS3Params & { Body: PutObjectRequest['Body'], ContentType?: PutObjectRequest['ContentType'] }): Promise<IS3UploadResponse> {
    return await this.upload({ ...params, ACL: 'public-read' });
  }

  async getPresignedUrl(params: TS3Params & { Expires: number, ResponseContentDisposition: string }): Promise<string> {
    const { Bucket, Key } = this.addDefaultBucket(params);
    const command = new GetObjectCommand({ Bucket, Key });
    const url = await getSignedUrl(this.s3, command, { expiresIn: params.Expires });

    return url;
  }

  async getFile(params: TS3Params) {
    if (!params?.Key) {
      throw new BadRequestException(`${S3Service.name}.${S3Service.prototype.getFile.name} requires a valid S3 key`)
    }

    const { Bucket, Key } = this.addDefaultBucket(params);
    const command = new GetObjectCommand({ Bucket, Key });
    return await this.s3.send(command);
  }

  async delete(params: TS3Params) {
    if (!params?.Key) {
      throw new BadRequestException(`${S3Service.name}.${S3Service.prototype.delete.name} requires a valid S3 key`)
    }

    const command = new DeleteObjectCommand(this.addDefaultBucket(params));
    const data = await this.s3.send(command);

    return data;
  }

  async deleteByPrefix(params: TS3PrefixParams) {
    if (!params?.Prefix) {
      throw new BadRequestException(`${S3Service.name}.${S3Service.prototype.deleteByPrefix.name} requires a valid S3 prefix`)
    }

    const command = new ListObjectsV2Command(this.addDefaultBucket(params));
    const data = await this.s3.send(command);

    const Objects = data.Contents.map(({ Key }) => ({ Key }));

    await this.deleteObjects(this.addDefaultBucket({ ...params, Objects }));
  }

  async deleteObjects(params: TS3ObjectsParams) {
    if (!params?.Objects?.length) {
      throw new BadRequestException(`${S3Service.name}.${S3Service.prototype.deleteByPrefix.name} requires an array of valid S3 keys`)
    }

    const { Objects, Bucket } = this.addDefaultBucket(params);

    if (Objects.length) {

      const command = new DeleteObjectsCommand({
        Bucket,
        Delete: { Objects }
      });

      return await this.s3.send(command);
    }
  }

  async getDownloadUrl(params: TS3Params & { fileName?: string | null | undefined }) {
    if (!params || !params?.Key) {
      throw new BadRequestException(`${S3Service.name}.${S3Service.prototype.getDownloadUrl.name} requires a valid S3 key`)
    }

    return await this.getPresignedUrl({
      ...this.addDefaultBucket(params),
      Expires: 100,
      ResponseContentDisposition: `attachment; filename="${params.fileName || params.Key.split('/').pop()}"`
    });
  }

  async getAssetUrl(params: TS3Params & { Expires?: number | null | undefined }) {
    if (!params || !params?.Key) {
      throw new BadRequestException(`${S3Service.name}.${S3Service.prototype.getAssetUrl.name} requires a valid S3 key`)
    }

    return await this.getPresignedUrl({
      ...this.addDefaultBucket(params),
      Expires: params.Expires || 10_000,
      ResponseContentDisposition: 'inline'
    })
  }

  private addDefaultBucket<TParams extends { Bucket?: string } & Record<string, any>>(params: TParams): TParams & { Bucket: string } {
    return { ...params, Bucket: this.getBucket(params?.Bucket) } as TParams & { Bucket: string };
  }

  private getBucket(Bucket?: string): string {
    return Bucket || this.config.AWS_BUCKET;
  }
}
