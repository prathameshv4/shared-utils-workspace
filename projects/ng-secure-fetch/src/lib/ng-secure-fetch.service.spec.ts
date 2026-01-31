import { TestBed } from '@angular/core/testing';

import { NgSecureFetchService } from './ng-secure-fetch.service';

describe('NgSecureFetchService', () => {
  let service: NgSecureFetchService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NgSecureFetchService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
