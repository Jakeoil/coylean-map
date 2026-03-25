package com.jakeoil.coylean.map;

import android.view.MotionEvent;
import android.view.SurfaceHolder;
import android.view.SurfaceView;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.util.Log;
/**
 * Constructor
 * @author Coyle
 *
 */
public class CoyleanSurfaceView 
   extends SurfaceView 
   implements SurfaceHolder.Callback
{
   /*
    * Graphics
    */
   Paint mPaint = new Paint();
   Canvas g;
   
   /**
    * Stuff for drawing
    */
   int mScreenWidth; /*rectangle of computation*/
   int mScreenHeight;
   int depth;    /* How many inside rectangles*/
   int scale; /* one of the main config variables*/
   int maxPri;   /* the most factors of 2*/

   int y_height; /* height and width of individual cells*/
   int x_width;
   int numOfDowns;
   int numOfRights;
   private boolean[] downArrows;
   private boolean[] rightArrows;
   int x_place;
   int y_place;
   private static final int DarkSeaGreen   = 0xFF000000 | 0x8FBC8F;
   private static final int BlanchedAlmond = 0xFF000000 | 0xFFEBCD;
   private static final int BlueViolet = 0xFF000000 | 0x8A2BE2;
   private static final int Cyan   = 0xFF000000 | 0x00FFFF;
   private static final int BurlyWood = 0xFF000000 | 0xDEB887;
   private static final int AntiqueWhite = 0xFF000000 | 0xFAEBD7;
   private static final int Coral     = 0xFF000000 | 0xFF7F50;
   private static final int Azure     = 0xFF000000 | 0xF0FFFF;
   private static final int DeepPink  = 0xFF000000 | 0xFF1493;
   private static final int LemonChiffon = 0xFF000000 | 0xFFFACD;
   private static final int Tomato    = 0xFF000000 | 0xFF6347;
   private static final int Firebrick = 0xFF000000 | 0xB22222;
   private static final int Silver    = 0xFF000000 | 0xC0C0C0;
   private static final int NavajoWhite = 0xFF000000 | 0xFFDEAD;
   private static final int Brown     = 0xFF000000 | 0xA52A2A;
   private static final int Fuchsia   = 0xFF000000 | 0xFF00FF;
   private static final int Turquoise = 0xFF000000 | 0x40E0D0;
   private static final int Magenta   = 0xFF000000 | 0xFF00FF;
   int[] colorList = {
      DarkSeaGreen,
      BlanchedAlmond,
      BlueViolet,
      Cyan,
      BurlyWood,
      AntiqueWhite,
      Coral,
      Azure,
      DeepPink,
      DarkSeaGreen,
      LemonChiffon,
      Tomato,
      Firebrick,
      Silver,
      NavajoWhite,
      Brown,
      Fuchsia,
      Turquoise,
      Magenta};
   /**
    * Debug and references to calling class
    */
   private static final String TAG = "Surface";
   private final Map map;

   private CoyleanThread mThread;
   //private Bitmap mBitmap;
   /**
    * Constructor for the surface view
    * @param context
    * @param attrs
    */
   public CoyleanSurfaceView(
      Context context)
      /*AttributeSet attrs)*/
   {
      super(context);
      SurfaceHolder holder = getHolder();
      holder.addCallback(this);
      /**
       * Initialize drawing stuff
       */
      scale = 4;
      maxPri = 12; /* We _could_ compute this */
      depth = 0;
      map=(Map)context;  // Used to get prefences
      mThread = new CoyleanThread(holder,this);
      // Make sure we get key and touch events
      setFocusable(true);
   }
   /*************************************
    * Draw the God damned map
    */
   @Override
   public void onDraw(Canvas canvas)
   {
      Log.d(TAG,"start_draw");
      g = canvas; // Expose to other methods
      //g.drawBitmap(mBitmap, 0, 0, null);
      mScreenWidth = this.getWidth();
      mScreenHeight = this.getHeight();
      g.drawColor(Color.WHITE);
      //boolean isTrue = true;
      //Paint paint = new Paint();
      //paint.setColor(Color.RED);      
      //g.drawRect(50,50,100,100, paint);
      //if (isTrue) return;
      int t = 0;

      y_height = 0;
      x_width = 0;

      numOfDowns = mScreenWidth / scale;
      Log.d("draw","numOfDowns = "+ numOfDowns);
      numOfRights = mScreenHeight / scale;
      if (map.complexity==Map.COMPLEXITY_ELABORATE) {
         // divide it again
         numOfDowns /= 2;
         numOfRights /= 2;
      }
      downArrows = new boolean[numOfDowns];
      rightArrows = new boolean[numOfRights];
      maxPri = ComputeMaxPri(numOfDowns, numOfRights);
      for (int y = 0; y < numOfRights; y++)
         rightArrows[y] = false;
      for (int x = 0; x < numOfDowns; x++)
         downArrows[x] = false;
      downArrows[0] = true;
      y_place = 0;
      for (int y = 0; y < numOfRights; y++) 
      {
         x_place = 0;
         for (int x = 0; x < numOfDowns; x++) 
         {
            boolean down = downArrows[x];
            boolean right = rightArrows[y];

            int downPri = Priority(x);
            int rightPri = Priority(y);
            if (downPri >= rightPri) 
            {
               if (down)
                  right = !right;
            } 
            else if (right)
               down = !down;
            if (map.complexity==Map.COMPLEXITY_ELABORATE) 
            {
               RenderComplex(downArrows[x], downPri, rightArrows[y],
                     rightPri, down, right);
            } 
            else 
            {
               RenderSimple(downArrows[x], rightArrows[y]);
            }
            t++;
            // if (t > clicks) return;
            // Set up for next iteration
            downArrows[x] = down;
            rightArrows[y] = right;
            x_place += x_width;
         }
         y_place += y_height;
      }
      
   }
   /************
    * Measures how "even" a number is
    */ 
   private int Priority(int i) {
      for (int j = 0; j < maxPri; j++) {
         if (i % 2 != 0)
            return j;
         i = i / 2;
      }
      return (maxPri);
   }

   /************
    * Just finds the log base 2
    */ 
   private int ComputeMaxPri(int ds, int rs) {
      if (ds < rs)
         ds = rs;
      for (int i = 0; i < 32; i++) {
         if (ds < 1)
            return i;
         ds = ds / 2;
      }
      return 32;
   }
   private void RenderSimple(
      boolean down, boolean right)
   {
      //Paint paint = mPaint;
      mPaint.setColor(Color.BLACK);
      mPaint.setStrokeWidth(1);
      mPaint.setStyle(Paint.Style.FILL_AND_STROKE); // find example for fill
      x_width = scale;
      y_height = scale;
      int x_r = x_place + scale;
      int y_b = y_place + scale;
      if (down)
         g.drawRect((float)x_r, (float)y_place,(float)x_r, (float)y_b,mPaint);
      if (right)
         g.drawRect((float)x_place, (float)y_b, (float)x_r, y_b, mPaint);
   }

   // =====================================================
   private void RenderComplex(
      boolean down, int downPri, boolean right,
         int rightPri, boolean down_out, boolean right_out)
   {
      int width  = downPri * 2;
      int height = rightPri * 2;
      x_width    = scale * width;
      y_height   = scale * height;
      for (int i = 0; i < maxPri; i++) {
         boolean work_done = true;
         if (i > maxPri - depth - 2) {
            work_done = false;
            mPaint.setColor(colorList[i]);
            mPaint.setStyle(Paint.Style.FILL); // find example for fill
            mPaint.setStrokeWidth(0);
            int w = width - 2 * i - 1;
            int h = height - 2 * i - 1;
            if (w > 0) 
            {
               if (down) 
               {
                  if (down_out) 
                  {
                     g.drawRect(
                        x_place + scale * (i+1),
                        y_place + 0,
                        x_place + scale * (i+1) + scale * w,
                        y_place + 0 + scale * (rightPri * 2), 
                        mPaint);
                     /*
                      * g.FillRectangle( b, x_place + scale * (i +  1), 
                      * y_place + 0, scale * w, scale * (rightPri * 2));
                      */
                  } else {
                     g.drawRect(
                        x_place + scale * (i+1), 
                        y_place + 0, 
                        x_place + scale * (i+1) + scale * w, 
                        y_place + 0 + scale * (rightPri+1),
                        mPaint);
                     /*
                      * g.FillRectangle( b, x_place + scale * (i + 1), 
                      * y_place + 0, scale * w, scale * (rightPri + 1));
                      */
                  }
               }
               if (down_out) {
                  g.drawRect( 
                     x_place + scale * (i + 1), 
                     y_place + scale * rightPri,
                     x_place + scale * (i + 1)+ scale * w, 
                     y_place + scale * rightPri + scale * rightPri,
                     mPaint);
          
                  /*
                   g.FillRectangle( b, x_place + scale * (i + 1), 
                   y_place + scale * rightPri,
                   scale * w, scale * rightPri);
                   */
               }
               work_done = true;
            }
            if (h > 0) 
            {
               if (right) 
               {
                  if (right_out) 
                  {
                     g.drawRect(
                        x_place + 0, 
                        y_place + scale * (i + 1), 
                        x_place + 0 + scale * (downPri * 2), 
                        y_place + scale * (i + 1)+scale * h, 
                        mPaint);
                     /*
                       drawRect( x_place + 0, 
                       y_place + scale * (i + 1), 
                       scale * (downPri * 2), scale * h);
                      */
                  }
                  {
                     g.drawRect( 
                        x_place + 0, 
                        y_place + scale * (i + 1), 
                        x_place + 0 + scale * (downPri + 1), 
                        y_place + scale * (i + 1)+ scale * h,
                        mPaint);
                     /*
                       g.FillRectangle( b, x_place + 0, 
                       y_place + scale * (i + 1), 
                       scale * (downPri + 1), scale * h);
                      */
                  }
               }
               if (right_out) {
                  g.drawRect(
                     x_place + scale * downPri,
                     y_place + scale * (i + 1), 
                     x_place + scale * downPri + scale * downPri, 
                     y_place + scale * (i + 1) + scale * h,
                     mPaint);
                  /*
                    g.FillRectangle( b, x_place + scale * downPri,
                    y_place + scale * (i + 1), scale * downPri, scale
                    * h);
                   */
               }
               work_done = true;
            }
         }
         if (!work_done)
            break;
      }
   }
   /****************************************************
    * Callback invoked when the surface properties, such
    *  as dimensions change. 
    ****************************************************/
   public void surfaceChanged(
      SurfaceHolder holder, 
      int format, 
      int width, int height) 
   {
      mScreenWidth=width;
      mScreenHeight=height;
      
      //mThread.setSurfaceSize(width, height);
   }
   
   /*******************************************************
    *  Callback invoked when the Surface has been created and is
    *  ready to be used 
    *  @param holder
    ******************************************************/
   public void surfaceCreated(SurfaceHolder holder) {
       // start the thread here so that we don't busy-wait in run()
       // waiting for the surface to be created
       mThread.setRunning(true);
       mThread.start();
   }


   /****************************************************
    * Callback invoked when the Surface has been destroyed and must no longer
    *   be touched. WARNING: after this method returns, the Surface/Canvas must
    *   never be touched again!
    ****************************************************/
   public void surfaceDestroyed(SurfaceHolder holder) 
   {
       // we have to tell thread to shut down & wait for it to finish, or else
       // it might touch the Surface after we return and explode
       boolean retry = true;
       mThread.setRunning(false);
       while (retry) {
           try {
               mThread.join();
               retry = false;
           } catch (InterruptedException e) {
           }
       }
   }
   
   /***************************************************************
    * This nested class has access to the surface view
    */
   class CoyleanThread extends Thread
   {
      private SurfaceHolder mSurfaceHolder;
      CoyleanSurfaceView mSurfaceView;
      private boolean mRun=false;
      
      /**
       * Constructor
       * @param surfaceHolder
       * @param view
       */
      public CoyleanThread(
         SurfaceHolder surfaceHolder,
         CoyleanSurfaceView view)
      {
         mSurfaceHolder = surfaceHolder;
         mSurfaceView = view;
         
         
      }
      /**********
       * Thread state
       * @param run
       */
      public void setRunning(boolean run)
      {
         mRun = run;
         
      }
      /****************************************
       * CoyleanThread.run
       */
      @Override public void run()
      {
         while (mRun)
         {
            Canvas c = null;
            try
            {
               c = mSurfaceHolder.lockCanvas(null);
               synchronized (mSurfaceHolder)
               {
                  mSurfaceView.onDraw(c);
                  
               }
            }
            finally
            {
               if (c != null)
               {
                  mSurfaceHolder.unlockCanvasAndPost(c);
               }
            }
         }
      }
  /*    
      public void setSurfaceSize(int width, int height)
      {
   
         synchronized (mSurfaceHolder) 
         {
            mScreenWidth = width;
            mScreenHeight = height;
            mBitmap = mBitmap.createScaledBitmap(
               mBitmap,width,height,true);
         }
            
      
      }
    */  
   }
   /**
    * Members of Coylean Surface View's framework
    */
   //private Context mContext;
   /**
    * Fetches the drawing thread
    * @return the thread
    */
   public CoyleanThread getThread()
   {
      return mThread;
   }
   /**
    * 
    */
   @Override public void onWindowFocusChanged(boolean hasWindowFocus)
   {
      //if(!hasWindowFocus)
        // mThread.pause();
   }
   private float mAnchorX=0;
   private float mAnchorY=0;
   private float mTouchStartX;
   private float mTouchStartY;
   private float mTouchCurrX;
   private float mTouchCurrY;
   @Override
   public boolean onTouchEvent(MotionEvent event) {
       float x = event.getX();
       float y = event.getY();
       
       switch (event.getAction()) {
           case MotionEvent.ACTION_DOWN:
               mTouchStartX = mTouchCurrX = x;
               mTouchStartY = mTouchCurrY = y;
               invalidate();
               break;
           case MotionEvent.ACTION_MOVE:
               mTouchCurrX = x;
               mTouchCurrY = y;
               invalidate();
               break;
           case MotionEvent.ACTION_UP:
               mAnchorX = mAnchorX + x - mTouchStartX;
               mAnchorY = mAnchorY + y - mTouchStartY;
               mTouchStartX = mTouchCurrX = x;
               mTouchStartY = mTouchCurrY = y;
               invalidate();
               break;
       }
       return true;
   }

}
