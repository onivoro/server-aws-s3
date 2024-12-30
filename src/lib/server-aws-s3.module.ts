import { Module } from '@nestjs/common';
import { S3, S3Client } from '@aws-sdk/client-s3';
import { S3Service } from './services/s3.service';
import { moduleFactory } from '@onivoro/server-common';
import { ServerAwsS3Config } from './classes/server-aws-s3-config.class';

@Module({})
export class ServerAwsS3Module {
  static configure(config: ServerAwsS3Config) {
    return moduleFactory({
      module: ServerAwsS3Module,
      providers: [
        {
          provide: S3Service,
          useFactory: () => new S3Service(
            config,
            new S3Client({
              region: config.AWS_REGION,
              credentials: config.NODE_ENV === 'production'
                ? undefined
                : {
                  accessKeyId: config.AWS_ACCESS_KEY_ID,
                  secretAccessKey: config.AWS_SECRET_ACCESS_KEY
                }
            })
          )
        }
      ]
    });
  }
}
