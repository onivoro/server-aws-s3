import { BadRequestException, Injectable } from '@nestjs/common';
import { S3 } from 'aws-sdk';
import { ServerAwsS3Config } from '../classes/server-aws-s3-config.class';
import { IS3UploadResponse } from '../interfaces/s3-upload-response.interface';
import { ListObjectsV2Request } from 'aws-sdk/clients/s3';

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
  constructor(private config: ServerAwsS3Config, private s3: S3) { }

  async upload(params: TS3Params & { Body: S3.PutObjectRequest['Body'], ACL?: S3.PutObjectRequest['ACL'], ContentType?: S3.PutObjectRequest['ContentType'] }): Promise<IS3UploadResponse> {
    // todo: sanitize filename here before uploading
    return await this.s3.upload(this.addDefaultBucket(params)).promise();
  }

  async uploadPublic(params: TS3Params & { Body: S3.PutObjectRequest['Body'], ContentType?: S3.PutObjectRequest['ContentType'] }): Promise<IS3UploadResponse> {
    // todo: sanitize filename here before uploading
    return await this.s3.upload({ ...this.addDefaultBucket(params), ACL: 'public-read' }).promise();
  }

  async getPresignedUrl(params: TS3Params & { Expires: number, ResponseContentDisposition: string }) {
    return await this.s3.getSignedUrlPromise('getObject', this.addDefaultBucket(params));
  }

  async getFile(params: TS3Params) {
    if (!params?.Key) {
      throw new BadRequestException(`${S3Service.name}.${S3Service.prototype.getFile.name} requires a valid S3 key`)
    }

    return await this.s3.getObject(this.addDefaultBucket(params)).promise();
  }

  async delete(params: TS3Params) {
    if (!params?.Key) {
      throw new BadRequestException(`${S3Service.name}.${S3Service.prototype.delete.name} requires a valid S3 key`)
    }

    return await this.s3.deleteObject(this.addDefaultBucket(params)).promise();
  }

  async deleteByPrefix(params: TS3PrefixParams) {
    if (!params?.Prefix) {
      throw new BadRequestException(`${S3Service.name}.${S3Service.prototype.deleteByPrefix.name} requires a valid S3 prefix`)
    }

    const data = await this.s3.listObjectsV2(this.addDefaultBucket(params)).promise();

    const Objects = data.Contents.map(({ Key }) => ({ Key }));

    await this.deleteObjects(this.addDefaultBucket({ ...params, Objects }));
  }

  async deleteObjects(params: TS3ObjectsParams) {
    if (!params?.Objects?.length) {
      throw new BadRequestException(`${S3Service.name}.${S3Service.prototype.deleteByPrefix.name} requires an array of valid S3 keys`)
    }

    const { Objects } = params;

    if (Objects.length) {
      const lee = this.addDefaultBucket({ Delete: { Objects } });
      await this.s3.deleteObjects(lee).promise();
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
