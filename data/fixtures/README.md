# Connector fixtures

Small documents used by the connector parser tests so CI needs no network.

- `aws/ec2_us-east-1_snippet.json`: hand-assembled from the real AWS price-list structure
  (products then terms); values are illustrative, the p5 prices match the 2026-09-25 file.
- `aws/ec2_terms_first.json`: same content with `terms` before `products`, which the streaming
  parser must reject.
- `vast/`, `runpod/`, `lambda/`, `silicondata/`, `ornn/`: best-known response shapes for vendors
  that are not reachable from the development sandbox. Each parser is marked
  `SHAPE_UNVERIFIED` until checked against a live response.
