#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(IoReactNativeProximity, NSObject)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

@end
