import { Module } from '@nestjs/common';
import { S3 } from 'aws-sdk';
import { S3Service } from './services/s3.service';
import { moduleFactory } from '@onivoro/server-common';
import { ServerAwsS3Config } from './classes/server-aws-s3-config.class';

// todo: add auth resolver to use iam role for deployment but creds locally

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
            new S3({
              maxRetries: 100,
              region: config.AWS_REGION,
              s3ForcePathStyle: true,
              credentials: {
                accessKeyId: config.AWS_ACCESS_KEY_ID,
                secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
              }
            })
          )
        }
      ]
    });
  }
}
