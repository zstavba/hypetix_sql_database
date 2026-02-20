import { Get, JsonController, Res } from 'routing-controllers';
import multer, { Options } from 'multer';

@JsonController()
export class GeneralServicesController {
  @Get('/general-services')
  getGeneralServices(@Res() res: any) {
    const generalServices = [
      {
        name: 'Digital products',
        items: [
          'Audiobook',
          'Digital Audio Visual Works - bundle - downloaded with limited rights and streamed - non subscription',
          'Digital Audio Visual Works - bundle - downloaded with permanent rights and streamed - non subscription',
          'E-book',
          'Online Course',
          'Software License',
          'Webinar',
          'Music Download',
          'Video Streaming',
          'Other Digital Product'
        ]
      },
      {
        name: 'Physical services',
        items: [
          'Consulting',
          'Repair Service',
          'Installation',
          'Maintenance',
          'Training',
          'Event Hosting',
          'Photography',
          'Catering',
          'Other Physical Service'
        ]
      }
    ];
    if (!res.headersSent) {
      return res.status(200).json(generalServices);
    }
  }
}
