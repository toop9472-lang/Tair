# app-ads.txt Setup (AdMob App Ownership)

Use this exact record:

```
google.com, pub-5132559433385403, DIRECT, f08c47fec0942fa0
```

## Production URL

The backend now serves app-ads.txt directly from:

```
https://saqr-ui-sync.emergent.host/app-ads.txt
```

## Important checks

1. The **Developer Website** domain in Google Play / App Store Connect must be the same domain used for `app-ads.txt`.
2. Open the URL in a browser and confirm it returns only the record above.
3. In AdMob, trigger re-crawl and wait for verification propagation (can take hours).
4. Avoid redirects from `/app-ads.txt` to another domain.
