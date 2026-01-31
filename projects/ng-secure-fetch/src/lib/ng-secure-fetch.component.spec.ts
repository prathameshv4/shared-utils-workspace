import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NgSecureFetchComponent } from './ng-secure-fetch.component';

describe('NgSecureFetchComponent', () => {
  let component: NgSecureFetchComponent;
  let fixture: ComponentFixture<NgSecureFetchComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NgSecureFetchComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NgSecureFetchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
